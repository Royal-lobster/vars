import { z } from "zod";

// ─── Schema Evaluation ─────────────────────────────

export interface EvalSuccess {
  success: true;
  schema: z.ZodTypeAny;
}

export interface EvalFailure {
  success: false;
  error: string;
}

export type EvalResult = EvalSuccess | EvalFailure;

/** Dangerous patterns that should never be evaluated */
const BLOCKED_PATTERNS = [
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bprocess\b/,
  /\bglobal\b/,
  /\bglobalThis\b/,
  /\beval\b/,
  /\bFunction\s*\(/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\b__proto__\b/,
  /\bconstructor\s*\[/,
];

/**
 * Evaluate a Zod schema string using real Zod.
 * Uses `new Function` with only `z` in scope — no access to Node globals.
 */
export function evaluateSchema(schemaText: string): EvalResult {
  // Block dangerous patterns before eval
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(schemaText)) {
      return { success: false, error: `Blocked: pattern "${pattern.source}" detected` };
    }
  }

  try {
    // Create a sandboxed function with only `z` available
    const fn = new Function("z", `"use strict"; return (${schemaText});`);
    const schema = fn(z);

    // Verify it's actually a Zod schema
    if (!schema || typeof schema !== "object" || !schema._def) {
      return { success: false, error: "Expression did not return a Zod schema" };
    }

    return { success: true, schema };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Schema Info Extraction ─────────────────────────

export interface SchemaInfo {
  typeName: string;
  checks: SchemaCheck[];
  isOptional: boolean;
  isCoerced: boolean;
  hasDefault: boolean;
  enumValues?: string[];
}

export interface SchemaCheck {
  kind: string;
  value?: unknown;
  message?: string;
}

/**
 * Extract type info from a Zod schema's `_def`.
 * Unwraps ZodOptional, ZodDefault, ZodEffects to find the inner type.
 */
export function getSchemaInfo(schema: z.ZodTypeAny): SchemaInfo {
  let isOptional = false;
  let hasDefault = false;
  let isCoerced = false;
  let current = schema;

  // Unwrap wrapper types
  while (current) {
    const typeName = current._def?.typeName;

    if (typeName === "ZodOptional") {
      isOptional = true;
      current = current._def.innerType;
      continue;
    }
    if (typeName === "ZodDefault") {
      hasDefault = true;
      current = current._def.innerType;
      continue;
    }
    if (typeName === "ZodEffects") {
      current = current._def.schema;
      continue;
    }
    break;
  }

  const def = current._def;
  const typeName: string = def?.typeName ?? "Unknown";

  // Check for coercion
  if (def?.coerce) {
    isCoerced = true;
  }

  // Extract checks (ZodString, ZodNumber have `.checks` array)
  const checks: SchemaCheck[] = [];
  if (Array.isArray(def?.checks)) {
    for (const check of def.checks) {
      const entry: SchemaCheck = { kind: check.kind };
      if (check.value !== undefined) entry.value = check.value;
      if (check.message !== undefined) entry.message = check.message;
      checks.push(entry);
    }
  }

  // Extract enum values
  let enumValues: string[] | undefined;
  if (typeName === "ZodEnum" && Array.isArray(def?.values)) {
    enumValues = def.values;
  }

  return { typeName, checks, isOptional, isCoerced, hasDefault, enumValues };
}

// ─── Method Discovery ───────────────────────────────

/** Internal/inherited methods to exclude from autocomplete */
const EXCLUDED_METHODS = new Set([
  "constructor",
  "_parse",
  "_parseSync",
  "_parseAsync",
  "_def",
  "_getType",
  "_getOrReturnCtx",
  "_processInputParams",
  "_refinement",
  "spa",
  "superRefine",
]);

/** Map of Zod type names to factory functions for creating representative instances */
const TYPE_FACTORIES: Record<string, () => z.ZodTypeAny> = {
  ZodString: () => z.string(),
  ZodNumber: () => z.number(),
  ZodBoolean: () => z.boolean(),
  ZodDate: () => z.date(),
  ZodBigInt: () => z.bigint(),
  ZodEnum: () => z.enum(["a"]),
  ZodNativeEnum: () => z.nativeEnum({ A: 0 } as const),
};

/**
 * Get available methods for a Zod type by name (e.g., "ZodString").
 * Creates a representative instance and introspects its prototype.
 */
export function getZodMethods(typeName: string): string[] {
  const factory = TYPE_FACTORIES[typeName];
  if (!factory) return [];

  try {
    const instance = factory();
    return getZodMethodsForType(instance);
  } catch {
    return [];
  }
}

/**
 * Get available methods from a live Zod schema instance.
 * Uses Object.getOwnPropertyNames on the prototype chain.
 */
export function getZodMethodsForType(schema: z.ZodTypeAny): string[] {
  const methods = new Set<string>();

  // Check instance own properties first (e.g., min/max aliases on ZodNumber)
  for (const name of Object.getOwnPropertyNames(schema)) {
    if (EXCLUDED_METHODS.has(name) || name.startsWith("_")) continue;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(schema, name);
      if (descriptor && typeof descriptor.value === "function") {
        methods.add(name);
      }
    } catch {
      // Skip properties that throw on access
    }
  }

  // Walk the prototype chain
  let proto = Object.getPrototypeOf(schema);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (EXCLUDED_METHODS.has(name) || name.startsWith("_")) continue;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        // Only include actual methods, not getters/setters
        if (descriptor && typeof descriptor.value === "function") {
          methods.add(name);
        }
      } catch {
        // Skip properties that throw on access
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return Array.from(methods).sort();
}
