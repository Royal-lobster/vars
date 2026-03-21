import {
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node.js";
import { evaluateSchema, getZodMethodsForType } from "./zod-introspect.js";

export interface CompletionContext {
  text: string;
  line: number;
  character: number;
  uri: string;
}

/** Standard environment names always suggested */
const STANDARD_ENVS = ["@dev", "@staging", "@prod", "@default", "@test"];

/** Metadata directives */
const DIRECTIVES = ["@description", "@deprecated", "@expires", "@owner"];

/** Top-level z.* factory methods */
const ZOD_FACTORIES = [
  "string",
  "number",
  "boolean",
  "date",
  "bigint",
  "enum",
  "nativeEnum",
  "coerce",
  "literal",
  "union",
  "optional",
  "nullable",
  "array",
  "object",
  "tuple",
  "record",
  "any",
  "unknown",
  "never",
  "void",
  "undefined",
  "null",
];

/**
 * Compute completions for a given cursor position in a .vars document.
 */
export function computeCompletions(ctx: CompletionContext): CompletionItem[] {
  const lines = ctx.text.split("\n");
  const currentLine = lines[ctx.line] ?? "";
  const textBeforeCursor = currentLine.substring(0, ctx.character);

  // Case 1: Inside a @refine line — suggest variable names after "env."
  if (isRefineEnvDot(textBeforeCursor)) {
    return getRefineVarCompletions(lines);
  }

  // Case 2: Indented line starting with @ — suggest env names or directives
  if (isIndentedAtLine(textBeforeCursor)) {
    return [
      ...getEnvNameCompletions(lines),
      ...getDirectiveCompletions(),
    ];
  }

  // Case 3: Zod schema on a variable declaration line
  const zodContext = getZodContext(textBeforeCursor);
  if (zodContext) {
    // After "z." at the top level — suggest factory methods
    if (zodContext.isTopLevel) {
      return ZOD_FACTORIES.map((name) => ({
        label: name,
        kind: CompletionItemKind.Function,
        detail: `z.${name}()`,
      }));
    }

    // After "z.coerce." — suggest coercible types
    if (zodContext.isCoerce) {
      return ["string", "number", "boolean", "date", "bigint"].map((name) => ({
        label: name,
        kind: CompletionItemKind.Function,
        detail: `z.coerce.${name}()`,
      }));
    }

    // After a chained method call — introspect the schema for available methods
    if (zodContext.schemaPrefix) {
      return getZodMethodCompletions(zodContext.schemaPrefix);
    }
  }

  return [];
}

/**
 * Check if cursor is after "env." inside a @refine line.
 */
function isRefineEnvDot(textBeforeCursor: string): boolean {
  const trimmed = textBeforeCursor.trimStart();
  if (trimmed.startsWith("@refine") && textBeforeCursor.endsWith("env.")) {
    return true;
  }
  return false;
}

/**
 * Check if this is an indented line starting with @.
 */
function isIndentedAtLine(textBeforeCursor: string): boolean {
  return /^\s+@/.test(textBeforeCursor);
}

/**
 * Extract Zod completion context from the text before cursor.
 */
function getZodContext(
  textBeforeCursor: string,
): { isTopLevel: boolean; isCoerce: boolean; schemaPrefix: string | null } | null {
  // Extract the schema part (everything after the variable name and spaces)
  const schemaMatch = textBeforeCursor.match(
    /(?:^[A-Z_][A-Z0-9_]*\s{2,})(z\..*)$/,
  );
  if (!schemaMatch) {
    // Also match standalone z. for less strict contexts
    const standaloneMatch = textBeforeCursor.match(/(z\..*)$/);
    if (!standaloneMatch) return null;
    return analyzeZodPrefix(standaloneMatch[1]);
  }
  return analyzeZodPrefix(schemaMatch[1]);
}

function analyzeZodPrefix(
  zodText: string,
): { isTopLevel: boolean; isCoerce: boolean; schemaPrefix: string | null } {
  // "z." exactly — top level
  if (zodText === "z.") {
    return { isTopLevel: true, isCoerce: false, schemaPrefix: null };
  }

  // "z.coerce." — suggest coercible types
  if (zodText === "z.coerce.") {
    return { isTopLevel: false, isCoerce: true, schemaPrefix: null };
  }

  // Ends with "." after a method chain — extract prefix for introspection
  if (zodText.endsWith(".")) {
    const prefix = zodText.slice(0, -1); // remove trailing dot
    return { isTopLevel: false, isCoerce: false, schemaPrefix: prefix };
  }

  return null;
}

/**
 * Get Zod method completions by evaluating the schema prefix and introspecting.
 */
function getZodMethodCompletions(schemaPrefix: string): CompletionItem[] {
  // Try to evaluate the prefix to get a live schema instance
  const result = evaluateSchema(schemaPrefix);
  if (!result.success) return [];

  const methods = getZodMethodsForType(result.schema);
  return methods.map((name) => ({
    label: name,
    kind: CompletionItemKind.Method,
    detail: `${schemaPrefix}.${name}()`,
  }));
}

/**
 * Collect environment names — standard names + any custom envs already in the file.
 */
function getEnvNameCompletions(lines: string[]): CompletionItem[] {
  const envNames = new Set(STANDARD_ENVS);

  // Scan for custom env names already used in the file
  for (const line of lines) {
    const match = line.match(/^\s+@(\w+)\s*=/);
    if (match) {
      envNames.add(`@${match[1]}`);
    }
  }

  return Array.from(envNames).map((name) => ({
    label: name,
    kind: CompletionItemKind.Value,
    detail: name === "@default" ? "Fallback value" : `Environment: ${name.slice(1)}`,
    insertText: `${name} = `,
  }));
}

/**
 * Get directive completions.
 */
function getDirectiveCompletions(): CompletionItem[] {
  return DIRECTIVES.map((name) => ({
    label: name,
    kind: CompletionItemKind.Keyword,
    detail: "Metadata directive",
    insertText: name === "@description" || name === "@deprecated"
      ? `${name} "`
      : `${name} `,
  }));
}

/**
 * Get variable name completions for @refine bodies.
 */
function getRefineVarCompletions(lines: string[]): CompletionItem[] {
  const varNames: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s{2,}z\./);
    if (match) {
      varNames.push(match[1]);
    }
  }

  return varNames.map((name) => ({
    label: name,
    kind: CompletionItemKind.Variable,
    detail: "Variable reference",
  }));
}
