import { z } from "zod";
import { ValidationError } from "./errors.js";

// Allowlist: only permit z.* method chains — no arbitrary code execution
const SAFE_SCHEMA_PATTERN = /^z\.[\w.(),"'\[\]\s:>=<|&!+\-\/]+$/;

const FALSY_STRINGS = new Set(["false", "0", ""]);

/**
 * A z.coerce.boolean() replacement that correctly handles env-var strings.
 * JS Boolean("false") === true, so we preprocess string values first.
 */
function envBoolean() {
  return z.preprocess((val) => {
    if (typeof val === "string") {
      return !FALSY_STRINGS.has(val.toLowerCase().trim());
    }
    return Boolean(val);
  }, z.boolean());
}

/**
 * Proxy over Zod's `z` that replaces `z.coerce.boolean()` with env-aware coercion.
 * All other methods pass through to Zod unchanged.
 */
const envZ: typeof z = new Proxy(z, {
  get(target, prop, receiver) {
    if (prop === "coerce") {
      return new Proxy(target.coerce, {
        get(coerceTarget, coerceProp) {
          if (coerceProp === "boolean") {
            return envBoolean;
          }
          return Reflect.get(coerceTarget, coerceProp);
        },
      });
    }
    return Reflect.get(target, prop, receiver);
  },
});

/** Alias: evaluateSchema is the internal name, parseSchema matches the PRD public API */
export const parseSchema = evaluateSchema;

export function evaluateSchema(schemaText: string): z.ZodType {
  if (!SAFE_SCHEMA_PATTERN.test(schemaText)) {
    throw new ValidationError(
      `Unsafe schema expression: ${schemaText}`,
      [{ variable: "", message: "Schema contains disallowed characters" }],
    );
  }

  // Additional safety: reject known dangerous patterns
  const dangerous = ["process", "require", "import", "eval", "Function", "globalThis", "window"];
  for (const word of dangerous) {
    if (schemaText.includes(word)) {
      throw new ValidationError(
        `Schema contains forbidden keyword: ${word}`,
        [{ variable: "", message: `Forbidden keyword: ${word}` }],
      );
    }
  }

  try {
    const fn = new Function("z", `"use strict"; return (${schemaText})`);
    const schema = fn(envZ);

    if (!(schema instanceof z.ZodType)) {
      throw new Error("Expression did not return a Zod schema");
    }

    return schema;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(
      `Invalid schema: ${schemaText} — ${(err as Error).message}`,
      [{ variable: "", message: (err as Error).message }],
    );
  }
}

export interface ValidateSuccess {
  success: true;
  value: unknown;
}

export interface ValidateFailure {
  success: false;
  issues: Array<{ message: string; path?: string[] }>;
}

export type ValidateResult = ValidateSuccess | ValidateFailure;

/** Alias: validateValue is the internal name, validate matches the PRD public API */
export const validate = validateValue;

export function validateValue(schemaText: string, value: unknown): ValidateResult {
  const schema = evaluateSchema(schemaText);
  const result = schema.safeParse(value);

  if (result.success) {
    return { success: true, value: result.data };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.map(String),
    })),
  };
}
