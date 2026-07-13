import { createHash } from "node:crypto";
import { isEncrypted } from "./crypto-constants.js";
import { generateServerless } from "./serverless-codegen.js";
import type { ResolvedVar, ResolvedVars } from "./types.js";

export interface CodegenOptions {
	platform?: "node" | "serverless" | "deno" | "static";
	/** For platform=serverless: the full per-env ResolvedVars map. If omitted, errors. */
	byEnv?: Record<string, import("./types.js").ResolvedVars>;
}

// ── Type inference ────────────────────────────────

export interface InferredType {
	base: string; // "string" | "number" | "boolean" | '"a" | "b"' | etc.
	optional: boolean;
	needsRedacted: boolean;
}

export function inferType(v: ResolvedVar): InferredType {
	const s = v.schema;
	const optional = s.includes(".optional()");

	// Compound roots must win over schemas nested inside them.
	if (/^\s*z\.array\(/.test(s)) {
		return { base: "unknown[]", optional, needsRedacted: !v.public };
	}
	if (/^\s*z\.object\(/.test(s)) {
		return { base: "Record<string, unknown>", optional, needsRedacted: !v.public };
	}

	// Enum — extract values
	const enumMatch = s.match(/^\s*z\.enum\(\[([^\]]+)\]\)/);
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
		return { base, optional, needsRedacted: !v.public };
	}

	// Number (always plain even if secret)
	if (/^\s*z\.(?:coerce\.)?number\(\)/.test(s)) {
		return { base: "number", optional, needsRedacted: !v.public };
	}

	// Boolean (always plain even if secret)
	if (/^\s*z\.(?:coerce\.)?boolean\(\)/.test(s)) {
		return { base: "boolean", optional, needsRedacted: !v.public };
	}

	// String (default)
	const isSecret = !v.public;
	return { base: "string", optional, needsRedacted: isSecret };
}

const key = (name: string): string =>
	name === "__proto__"
		? `[${JSON.stringify(name)}]`
		: /^[A-Za-z_$][\w$]*$/.test(name)
			? name
			: JSON.stringify(name);
const access = (object: string, name: string): string =>
	/^[A-Za-z_$][\w$]*$/.test(name) && name !== "__proto__"
		? `${object}.${name}`
		: `${object}[${JSON.stringify(name)}]`;

function parseSourceValue(source: string, inf: InferredType): string {
	if (inf.base === "number") return `${source} !== undefined ? Number(${source}) : undefined`;
	if (inf.base === "boolean") {
		return `${source} !== undefined ? (${source} === "true" || ${source} === "1") : undefined`;
	}
	if (inf.base === "unknown[]" || inf.base === "Record<string, unknown>") {
		return `${source} !== undefined ? JSON.parse(${source}) : undefined`;
	}
	return source;
}

function renderType(inf: InferredType): string {
	let t = inf.needsRedacted ? `Redacted<${inf.base}>` : inf.base;
	if (inf.optional) t += " | undefined";
	return t;
}

// ── Grouping ──────────────────────────────────────

export interface GroupedVars {
	topLevel: ResolvedVar[];
	groups: Map<string, ResolvedVar[]>;
}

export function groupVars(vars: ResolvedVar[]): GroupedVars {
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

export function generateSchemaBlock(grouped: GroupedVars): string {
	const lines: string[] = [];
	lines.push("const schema = z.object({");

	for (const v of grouped.topLevel) {
		lines.push(`  ${key(v.name)}: ${v.schema},`);
	}

	for (const [groupName, vars] of grouped.groups) {
		lines.push(`  ${key(groupName)}: z.object({`);
		for (const v of vars) {
			lines.push(`    ${key(v.name)}: ${v.schema},`);
		}
		lines.push("  }),");
	}

	lines.push("});");
	return lines.join("\n");
}

// ── Vars type block ───────────────────────────────

export function generateVarsType(grouped: GroupedVars): string {
	const lines: string[] = [];
	lines.push("export type Vars = {");

	for (const v of grouped.topLevel) {
		const inf = inferType(v);
		const optMark = inf.optional ? "?" : "";
		lines.push(`  ${key(v.name)}${optMark}: ${renderType(inf)};`);
	}

	for (const [groupName, vars] of grouped.groups) {
		lines.push(`  ${key(groupName)}: {`);
		for (const v of vars) {
			const inf = inferType(v);
			const optMark = inf.optional ? "?" : "";
			lines.push(`    ${key(v.name)}${optMark}: ${renderType(inf)};`);
		}
		lines.push("  };");
	}

	lines.push("};");
	return lines.join("\n");
}

// ── ClientVars type block ─────────────────────────

function generateClientVarsType(grouped: GroupedVars): string {
	const publicTopLevel = grouped.topLevel.filter((v) => v.public).map((v) => `"${v.name}"`);

	// Separate groups into fully-public and mixed (partial) groups
	const fullyPublicGroupKeys: string[] = [];
	const partialGroups = new Map<string, string[]>(); // groupName -> public var names

	for (const [groupName, vars] of grouped.groups) {
		const publicVars = vars.filter((v) => v.public);
		if (publicVars.length === 0) continue;

		if (publicVars.length === vars.length) {
			// All vars in group are public — safe to pick the whole group
			fullyPublicGroupKeys.push(`"${groupName}"`);
		} else {
			// Mixed group — only pick individual public vars
			partialGroups.set(
				groupName,
				publicVars.map((v) => `"${v.name}"`),
			);
		}
	}

	const pickKeys = [...publicTopLevel, ...fullyPublicGroupKeys];
	const hasPickKeys = pickKeys.length > 0;
	const hasPartialGroups = partialGroups.size > 0;

	if (!hasPickKeys && !hasPartialGroups) {
		return "export type ClientVars = Record<string, never>;";
	}

	const parts: string[] = [];

	if (hasPickKeys) {
		parts.push(`Pick<Vars, ${pickKeys.join(" | ")}>`);
	}

	if (hasPartialGroups) {
		const lines: string[] = [];
		lines.push("{");
		for (const [groupName, varNames] of partialGroups) {
			lines.push(`  ${groupName}: Pick<Vars["${groupName}"], ${varNames.join(" | ")}>;`);
		}
		lines.push("}");
		parts.push(lines.join("\n"));
	}

	return `export type ClientVars = ${parts.join(" & ")};`;
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
		lines.push(
			`  ${access("raw", v.name)} = ${parseSourceValue(access("source", v.flatName), inf)};`,
		);
	}

	// Groups
	for (const [groupName, vars] of grouped.groups) {
		lines.push(`  ${access("raw", groupName)} = {`);
		for (const v of vars) {
			const inf = inferType(v);
			lines.push(`    ${key(v.name)}: ${parseSourceValue(access("source", v.flatName), inf)},`);
		}
		lines.push("  };");
	}

	lines.push("");
	lines.push("  const parsed = schema.parse(raw);");
	lines.push("  return {");

	// Top-level
	for (const v of grouped.topLevel) {
		const inf = inferType(v);
		const parsed = access("parsed", v.name);
		if (inf.needsRedacted) {
			const wrapped = `new Redacted(${parsed} as ${inf.base})`;
			lines.push(
				`    ${key(v.name)}: ${inf.optional ? `${parsed} === undefined ? undefined : ${wrapped}` : wrapped},`,
			);
		} else {
			lines.push(`    ${key(v.name)}: ${parsed},`);
		}
	}

	// Groups
	for (const [groupName, vars] of grouped.groups) {
		lines.push(`    ${key(groupName)}: {`);
		for (const v of vars) {
			const inf = inferType(v);
			const accessor = access(
				`(${access("parsed", groupName)} as Record<string, unknown>)`,
				v.name,
			);
			if (inf.needsRedacted) {
				const wrapped = `new Redacted(${accessor} as ${inf.base})`;
				lines.push(
					`      ${key(v.name)}: ${inf.optional ? `${accessor} === undefined ? undefined : ${wrapped}` : wrapped},`,
				);
			} else {
				lines.push(`      ${key(v.name)}: ${accessor} as ${inf.base},`);
			}
		}
		lines.push("    },");
	}

	lines.push("  };");
	lines.push("}");
	return lines.join("\n");
}

// ── Static export block ───────────────────────────

function generateStaticExport(grouped: GroupedVars): string {
	// Detect encrypted values — static codegen requires decrypted values
	const allVars = [...grouped.topLevel, ...Array.from(grouped.groups.values()).flat()];
	for (const v of allVars) {
		if (v.value && isEncrypted(v.value)) {
			throw new Error(
				`Static codegen requires decrypted values. Variable "${v.flatName}" contains an encrypted value. Run \`vars show\` first or use a non-static platform.`,
			);
		}
	}

	const lines: string[] = [];
	lines.push("export const vars: Vars = {");
	const render = (v: ResolvedVar): string => {
		if (v.value === undefined) return "undefined";
		const inf = inferType(v);
		let value: string;
		if (inf.base === "number") value = String(Number(v.value));
		else if (inf.base === "boolean") value = String(v.value === "true" || v.value === "1");
		else if (inf.base === "unknown[]" || inf.base === "Record<string, unknown>") {
			value = JSON.stringify(JSON.parse(v.value));
		} else value = JSON.stringify(v.value);
		return inf.needsRedacted ? `new Redacted(${value})` : value;
	};

	for (const v of grouped.topLevel) {
		lines.push(`  ${key(v.name)}: ${render(v)},`);
	}

	for (const [groupName, vars] of grouped.groups) {
		lines.push(`  ${key(groupName)}: {`);
		for (const v of vars) {
			lines.push(`    ${key(v.name)}: ${render(v)},`);
		}
		lines.push("  },");
	}

	lines.push("};");
	return lines.join("\n");
}

// ── clientVars export ─────────────────────────────

function generateClientVarsExport(grouped: GroupedVars): string {
	const publicTopLevel = grouped.topLevel.filter((v) => v.public);
	const fullyPublicGroups: string[] = [];
	const partialGroups = new Map<string, ResolvedVar[]>();

	for (const [groupName, vars] of grouped.groups) {
		const pub = vars.filter((v) => v.public);
		if (pub.length === 0) continue;

		if (pub.length === vars.length) {
			fullyPublicGroups.push(groupName);
		} else {
			partialGroups.set(groupName, pub);
		}
	}

	if (publicTopLevel.length === 0 && fullyPublicGroups.length === 0 && partialGroups.size === 0) {
		return "export const clientVars: ClientVars = {};";
	}

	const lines: string[] = [];
	lines.push("export const clientVars: ClientVars = {");

	for (const v of publicTopLevel) {
		lines.push(`  ${key(v.name)}: ${access("vars", v.name)},`);
	}

	for (const groupName of fullyPublicGroups) {
		lines.push(`  ${key(groupName)}: ${access("vars", groupName)},`);
	}

	for (const [groupName, pubVars] of partialGroups) {
		lines.push(`  ${key(groupName)}: {`);
		for (const v of pubVars) {
			lines.push(`    ${key(v.name)}: ${access(access("vars", groupName), v.name)},`);
		}
		lines.push("  },");
	}

	lines.push("};");
	return lines.join("\n");
}

// ── Inline Redacted class ─────────────────────────

export const REDACTED_CLASS = `class Redacted<T> {
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

	if (platform === "serverless") {
		if (!options?.byEnv) {
			throw new Error("generateTypeScript: platform=serverless requires options.byEnv");
		}
		return generateServerless(options.byEnv);
	}

	// Compute source hash
	const hashInput = resolved.sourceFiles.sort().join("|");
	const sourceHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 8);

	const grouped = groupVars(resolved.vars);

	const parts: string[] = [];

	// Header
	parts.push("// @generated by vars — do not edit");
	parts.push(`// @vars-platform: ${platform}`);
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
		} else if (platform === "deno") {
			parts.push("export const vars: Vars = parseVars(Deno.env.toObject());");
			parts.push("");
			parts.push(generateClientVarsExport(grouped));
		} else {
			const _exhaustive: never = platform;
			throw new Error(`unknown platform: ${String(_exhaustive)}`);
		}
	}

	return parts.join("\n");
}
