import { z } from "zod";

const FORBIDDEN_KEYWORDS = [
  "process", "require", "import", "eval", "Function",
  "globalThis", "window", "document", "fetch",
  "constructor", "prototype", "__proto__",
];

const ALLOWED_ZOD_METHODS = new Set([
  // Primitives
  "string", "number", "boolean", "bigint", "date", "symbol", "undefined", "null", "void", "any", "unknown", "never",
  // Containers
  "array", "object", "tuple", "record", "map", "set", "union", "intersection", "discriminatedUnion",
  // Modifiers
  "optional", "nullable", "nullish", "default", "catch", "transform", "refine", "pipe", "brand",
  // Validators
  "min", "max", "length", "email", "url", "uuid", "regex", "startsWith", "endsWith", "includes", "trim", "toLowerCase", "toUpperCase",
  // Numeric
  "int", "positive", "negative", "nonnegative", "nonpositive", "finite", "safe", "multipleOf", "step",
  // Coercion
  "coerce",
  // Enum
  "enum", "nativeEnum",
  // Effects
  "preprocess", "superRefine",
  // Literal
  "literal",
]);

function validateSchemaAllowlist(schemaText: string): void {
  // Extract all method calls: match .identifier( patterns
  const methodPattern = /\.(\w+)\s*\(/g;
  let match;
  while ((match = methodPattern.exec(schemaText)) !== null) {
    const method = match[1];
    if (!ALLOWED_ZOD_METHODS.has(method)) {
      throw new Error(`Unknown schema method "${method}" in: ${schemaText}`);
    }
  }

  // Reject bracket property access notation (bypass vector): )[" or )['
  // This catches z.string()["constructor"] while allowing z.enum(["a", "b"])
  if (/\)\s*\[/.test(schemaText)) {
    throw new Error(`Bracket notation is not allowed in schemas: ${schemaText}`);
  }

  // Reject backtick template literals
  if (schemaText.includes("`")) {
    throw new Error(`Template literals are not allowed in schemas: ${schemaText}`);
  }
}

export function evaluateSchema(schemaText: string): z.ZodType {
  // Primary security: must start with z.
  if (!schemaText.startsWith("z.")) {
    throw new Error(`Schema must start with "z." — got: ${schemaText}`);
  }

  // Primary security: allowlist of known Zod methods
  validateSchemaAllowlist(schemaText);

  // Defense in depth: reject forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (schemaText.includes(keyword)) {
      throw new Error(`Schema contains forbidden keyword "${keyword}": ${schemaText}`);
    }
  }

  // Handle z.coerce.boolean() specially — Zod coerces any truthy string to true,
  // but env vars conventionally treat "false"/"0"/"" as false.
  const needsBooleanFix = schemaText.includes("z.coerce.boolean()");
  const processedSchema = needsBooleanFix
    ? schemaText.replace(
        "z.coerce.boolean()",
        "z.preprocess((val) => { if (typeof val === 'string') { const lower = val.toLowerCase(); if (lower === 'false' || lower === '0' || lower === '') return false; return true; } return val; }, z.boolean())"
      )
    : schemaText;

  try {
    const fn = new Function("z", `"use strict"; return ${processedSchema}`);
    return fn(z);
  } catch (err) {
    throw new Error(`Invalid schema expression: ${schemaText} — ${err}`);
  }
}

export interface ValidateResult {
  success: boolean;
  value?: unknown;
  issues?: Array<{ message: string }>;
}

export function validateValue(schemaText: string, value: unknown): ValidateResult {
  const schema = evaluateSchema(schemaText);

  // Coerce string values for number/boolean schemas (env vars are always strings)
  let coerced = value;
  if (typeof value === "string") {
    if (schemaText.includes("z.number") || schemaText.includes("z.coerce.number")) {
      const num = Number(value);
      if (!isNaN(num)) coerced = num;
    }
    if (schemaText.includes("z.boolean") && !schemaText.includes("z.coerce.boolean")) {
      if (value === "true") coerced = true;
      else if (value === "false") coerced = false;
    }
  }

  const result = schema.safeParse(coerced);
  if (result.success) {
    return { success: true, value: result.data };
  }
  return {
    success: false,
    issues: result.error.issues.map((i) => ({ message: i.message })),
  };
}
