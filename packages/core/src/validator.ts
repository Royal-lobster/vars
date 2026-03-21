import { z } from "zod";
import vm from "node:vm";
import { ValidationError } from "./errors.js";

// Reject schemas that contain callback-accepting Zod methods (code execution vectors)
const CALLBACK_METHODS = /\.(transform|refine|superRefine|preprocess|pipe)\s*\(/;

/** Alias: evaluateSchema is the internal name, parseSchema matches the PRD public API */
export const parseSchema = evaluateSchema;

export function evaluateSchema(schemaText: string): z.ZodType {
  // Block callback-accepting methods — these allow arbitrary code in Zod's execution
  if (CALLBACK_METHODS.test(schemaText)) {
    throw new ValidationError(
      `Schema contains forbidden callback method: ${schemaText}`,
      [{ variable: "", message: "Callback methods (.transform, .refine, etc.) are not allowed in .vars schemas" }],
    );
  }

  try {
    const sandbox = { z, result: undefined as unknown };
    vm.runInNewContext(`result = (${schemaText})`, sandbox, {
      timeout: 100,
      filename: "vars-schema-eval",
    });

    if (!(sandbox.result instanceof z.ZodType)) {
      throw new Error("Expression did not return a Zod schema");
    }

    return sandbox.result;
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
