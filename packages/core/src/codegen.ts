import { createHash } from "node:crypto";
import type { ResolvedVar, ResolvedVars } from "./types.js";

export interface CodegenOptions {
  platform?: "node" | "cloudflare" | "deno" | "static";
}

// ── Type inference ────────────────────────────────

interface InferredType {
  base: string; // "string" | "number" | "boolean" | '"a" | "b"' | etc.
  optional: boolean;
  needsRedacted: boolean; // true only for secret strings
}

function inferType(v: ResolvedVar): InferredType {
  const s = v.schema;
  const optional = s.includes(".optional()");

  // Enum — extract values
  const enumMatch = s.match(/z\.enum\(\[([^\]]+)\]\)/);
  if (enumMatch) {
    // Parse the enum values from the matched content
    const inner = enumMatch[1];
    const values: string[] = [];
    const re = /"([^"\\]*)"|'([^'\\]*)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      values.push(`"${m[1] ?? m[2]}"`);
    }
    const base = values.join(" | ");
    return { base, optional, needsRedacted: false };
  }

  // Number (always plain even if secret)
  if (s.includes("z.number()") || s.includes("z.coerce.number()")) {
    return { base: "number", optional, needsRedacted: false };
  }

  // Boolean (always plain even if secret)
  if (s.includes("z.boolean()") || s.includes("z.coerce.boolean()")) {
    return { base: "boolean", optional, needsRedacted: false };
  }

  // Array
  if (s.includes("z.array(")) {
    return { base: "unknown[]", optional, needsRedacted: false };
  }

  // Object
  if (s.includes("z.object(")) {
    return { base: "Record<string, unknown>", optional, needsRedacted: false };
  }

  // String (default)
  const isSecret = !v.public;
  return { base: "string", optional, needsRedacted: isSecret };
}

function renderType(inf: InferredType): string {
  let t = inf.needsRedacted ? `Redacted<${inf.base}>` : inf.base;
  if (inf.optional) t += " | undefined";
  return t;
}

// ── Grouping ──────────────────────────────────────

interface GroupedVars {
  topLevel: ResolvedVar[];
  groups: Map<string, ResolvedVar[]>;
}

function groupVars(vars: ResolvedVar[]): GroupedVars {
  const topLevel: ResolvedVar[] = [];
  const groups = new Map<string, ResolvedVar[]>();

  for (const v of vars) {
    if (v.group) {
      if (!groups.has(v.group)) groups.set(v.group, []);
      groups.get(v.group)!.push(v);
    } else {
      topLevel.push(v);
    }
  }

  return { topLevel, groups };
}

// ── Schema block ──────────────────────────────────

function generateSchemaBlock(grouped: GroupedVars): string {
  const lines: string[] = [];
  lines.push("const schema = z.object({");

  for (const v of grouped.topLevel) {
    lines.push(`  ${v.name}: ${v.schema},`);
  }

  for (const [groupName, vars] of grouped.groups) {
    lines.push(`  ${groupName}: z.object({`);
    for (const v of vars) {
      lines.push(`    ${v.name}: ${v.schema},`);
    }
    lines.push(`  }),`);
  }

  lines.push("});");
  return lines.join("\n");
}

// ── Vars type block ───────────────────────────────

function generateVarsType(grouped: GroupedVars): string {
  const lines: string[] = [];
  lines.push("export type Vars = {");

  for (const v of grouped.topLevel) {
    const inf = inferType(v);
    const optMark = inf.optional ? "?" : "";
    lines.push(`  ${v.name}${optMark}: ${renderType(inf)};`);
  }

  for (const [groupName, vars] of grouped.groups) {
    lines.push(`  ${groupName}: {`);
    for (const v of vars) {
      const inf = inferType(v);
      const optMark = inf.optional ? "?" : "";
      lines.push(`    ${v.name}${optMark}: ${renderType(inf)};`);
    }
    lines.push(`  };`);
  }

  lines.push("};");
  return lines.join("\n");
}

// ── ClientVars type block ─────────────────────────

function generateClientVarsType(grouped: GroupedVars): string {
  const publicTopLevel = grouped.topLevel.filter(v => v.public).map(v => `"${v.name}"`);

  // For groups, check if any public vars exist in a group
  const publicGroupKeys: string[] = [];
  for (const [groupName, vars] of grouped.groups) {
    if (vars.some(v => v.public)) {
      publicGroupKeys.push(`"${groupName}"`);
    }
  }

  const allPublicKeys = [...publicTopLevel, ...publicGroupKeys];

  if (allPublicKeys.length === 0) {
    return "export type ClientVars = Record<string, never>;";
  }

  return `export type ClientVars = Pick<Vars, ${allPublicKeys.join(" | ")}>;`;
}

// ── parseVars function ────────────────────────────

function generateParseVars(grouped: GroupedVars): string {
  const lines: string[] = [];
  lines.push("function parseVars(source: Record<string, string | undefined>): Vars {");
  lines.push("  const raw: Record<string, unknown> = {};");
  lines.push("");

  // Top-level vars
  for (const v of grouped.topLevel) {
    const inf = inferType(v);
    if (inf.base === "number") {
      lines.push(`  raw.${v.name} = source.${v.flatName} !== undefined ? Number(source.${v.flatName}) : undefined;`);
    } else if (inf.base === "boolean") {
      lines.push(`  raw.${v.name} = source.${v.flatName} !== undefined ? (source.${v.flatName} === "true" || source.${v.flatName} === "1") : undefined;`);
    } else {
      lines.push(`  raw.${v.name} = source.${v.flatName};`);
    }
  }

  // Groups
  for (const [groupName, vars] of grouped.groups) {
    lines.push(`  raw.${groupName} = {`);
    for (const v of vars) {
      const inf = inferType(v);
      if (inf.base === "number") {
        lines.push(`    ${v.name}: source.${v.flatName} !== undefined ? Number(source.${v.flatName}) : undefined,`);
      } else if (inf.base === "boolean") {
        lines.push(`    ${v.name}: source.${v.flatName} !== undefined ? (source.${v.flatName} === "true" || source.${v.flatName} === "1") : undefined,`);
      } else {
        lines.push(`    ${v.name}: source.${v.flatName},`);
      }
    }
    lines.push(`  };`);
  }

  lines.push("");
  lines.push("  const parsed = schema.parse(raw);");
  lines.push("  return {");

  // Top-level
  for (const v of grouped.topLevel) {
    const inf = inferType(v);
    if (inf.needsRedacted) {
      lines.push(`    ${v.name}: new Redacted(parsed.${v.name} as string),`);
    } else {
      lines.push(`    ${v.name}: parsed.${v.name},`);
    }
  }

  // Groups
  for (const [groupName, vars] of grouped.groups) {
    lines.push(`    ${groupName}: {`);
    for (const v of vars) {
      const inf = inferType(v);
      const accessor = `(parsed.${groupName} as Record<string, unknown>)`;
      if (inf.needsRedacted) {
        lines.push(`      ${v.name}: new Redacted(${accessor}.${v.name} as string),`);
      } else {
        lines.push(`      ${v.name}: ${accessor}.${v.name} as ${inf.base},`);
      }
    }
    lines.push(`    },`);
  }

  lines.push("  };");
  lines.push("}");
  return lines.join("\n");
}

// ── Static export block ───────────────────────────

function generateStaticExport(grouped: GroupedVars): string {
  const lines: string[] = [];
  lines.push("export const vars: Vars = {");

  for (const v of grouped.topLevel) {
    const inf = inferType(v);
    const val = v.value ?? "undefined";
    if (inf.needsRedacted) {
      lines.push(`  ${v.name}: new Redacted(${JSON.stringify(val)}),`);
    } else if (inf.base === "number") {
      lines.push(`  ${v.name}: ${Number(val)},`);
    } else if (inf.base === "boolean") {
      lines.push(`  ${v.name}: ${val === "true" || val === "1"},`);
    } else {
      lines.push(`  ${v.name}: ${JSON.stringify(val)},`);
    }
  }

  for (const [groupName, vars] of grouped.groups) {
    lines.push(`  ${groupName}: {`);
    for (const v of vars) {
      const inf = inferType(v);
      const val = v.value ?? "undefined";
      if (inf.needsRedacted) {
        lines.push(`    ${v.name}: new Redacted(${JSON.stringify(val)}),`);
      } else if (inf.base === "number") {
        lines.push(`    ${v.name}: ${Number(val)},`);
      } else if (inf.base === "boolean") {
        lines.push(`    ${v.name}: ${val === "true" || val === "1"},`);
      } else {
        lines.push(`    ${v.name}: ${JSON.stringify(val)},`);
      }
    }
    lines.push(`  },`);
  }

  lines.push("};");
  return lines.join("\n");
}

// ── clientVars export ─────────────────────────────

function generateClientVarsExport(grouped: GroupedVars): string {
  const publicTopLevel = grouped.topLevel.filter(v => v.public);
  const publicGroups = new Map<string, ResolvedVar[]>();

  for (const [groupName, vars] of grouped.groups) {
    const pub = vars.filter(v => v.public);
    if (pub.length > 0) {
      publicGroups.set(groupName, pub);
    }
  }

  if (publicTopLevel.length === 0 && publicGroups.size === 0) {
    return "export const clientVars: ClientVars = {};";
  }

  const lines: string[] = [];
  lines.push("export const clientVars: ClientVars = {");

  for (const v of publicTopLevel) {
    lines.push(`  ${v.name}: vars.${v.name},`);
  }

  for (const [groupName] of publicGroups) {
    lines.push(`  ${groupName}: vars.${groupName},`);
  }

  lines.push("};");
  return lines.join("\n");
}

// ── Inline Redacted class ─────────────────────────

const REDACTED_CLASS = `class Redacted<T> {
  #value: T;
  constructor(value: T) {
    this.#value = value;
  }
  unwrap(): T {
    return this.#value;
  }
  toString(): string {
    return '<redacted>';
  }
  toJSON(): string {
    return '<redacted>';
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '<redacted>';
  }
}`;

// ── Main codegen function ─────────────────────────

export function generateTypeScript(resolved: ResolvedVars, options?: CodegenOptions): string {
  const platform = options?.platform ?? "node";

  // Compute source hash
  const hashInput = resolved.sourceFiles.sort().join("|");
  const sourceHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 8);

  const grouped = groupVars(resolved.vars);

  const parts: string[] = [];

  // Header
  parts.push(`// @generated by vars — do not edit`);
  parts.push(`// @vars-source-hash: ${sourceHash}`);
  parts.push("");

  // Imports
  parts.push(`import { z } from 'zod'`);
  parts.push("");

  // Redacted class
  parts.push(REDACTED_CLASS);
  parts.push("");

  if (platform !== "static") {
    // Schema
    parts.push(generateSchemaBlock(grouped));
    parts.push("");
  }

  // Types
  parts.push(generateVarsType(grouped));
  parts.push("");

  parts.push(generateClientVarsType(grouped));
  parts.push("");

  if (platform === "static") {
    // No parseVars — inline values directly
    parts.push(generateStaticExport(grouped));
    parts.push("");
  } else {
    // parseVars function
    parts.push(generateParseVars(grouped));
    parts.push("");

    // Platform-specific export
    if (platform === "node") {
      parts.push("export const vars: Vars = parseVars(process.env);");
      parts.push("");
      parts.push(generateClientVarsExport(grouped));
    } else if (platform === "cloudflare") {
      parts.push("export function getVars(env: Record<string, string>): Vars {");
      parts.push("  return parseVars(env);");
      parts.push("}");
      // clientVars doesn't make sense for Cloudflare (no module-level vars object)
    } else if (platform === "deno") {
      parts.push("export const vars: Vars = parseVars(Deno.env.toObject());");
      parts.push("");
      parts.push(generateClientVarsExport(grouped));
    }
  }

  return parts.join("\n");
}
