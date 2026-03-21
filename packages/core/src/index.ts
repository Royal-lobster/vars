import { readFileSync } from "node:fs";
import { z } from "zod";
import { decrypt, isEncrypted } from "./crypto.js";
import { ParseError, ValidationError } from "./errors.js";
import type { LoadOptions, VarsFile } from "./types.js";
import { parse } from "./parser.js";
import { evaluateSchema } from "./validator.js";
import { resolveAllValues } from "./resolver.js";
import { applyRefines } from "./refine.js";
import { Redacted } from "./redacted.js";
import { resolveExtends } from "./extends.js";

export { Redacted } from "./redacted.js";
export { encrypt, decrypt, isEncrypted } from "./crypto.js";
export { parse } from "./parser.js";
export { evaluateSchema, validateValue, parseSchema, validate } from "./validator.js";
export { resolveValue, resolveAllValues } from "./resolver.js";
export { applyRefines, extractReferencedVars } from "./refine.js";
export { resolveExtends } from "./extends.js";
export { generateTypes } from "./codegen.js";
export { createMasterKey, encryptMasterKey, decryptMasterKey } from "./keymanager.js";
export { storeKey, retrieveKey, clearKey } from "./keychain.js";
export { extractValue, readKeyFile, regenerateIfStale, resolveVarsFile } from "./plugin-utils.js";
export type * from "./types.js";
export * from "./errors.js";

export function loadVars(
  filePath: string,
  options: LoadOptions = {},
): Record<string, any> {
  const env = options.env ?? "development";
  const key = options.key
    ? typeof options.key === "string"
      ? Buffer.from(options.key, "base64")
      : options.key
    : undefined;

  // 1. Parse (with @extends resolution)
  const varsFile = resolveExtends(filePath);

  // 2. Resolve values for target environment
  const resolved = resolveAllValues(varsFile.variables, env);

  // 3. Decrypt encrypted values
  const decrypted = new Map<string, string | undefined>();
  for (const [name, value] of resolved) {
    if (value && isEncrypted(value)) {
      if (!key) {
        throw new ValidationError("Encrypted values found but no key provided", [
          { variable: name, message: "No decryption key" },
        ]);
      }
      decrypted.set(name, decrypt(value, key));
    } else {
      decrypted.set(name, value);
    }
  }

  // 4. Build Zod schema object and validate
  const schemaShape: Record<string, z.ZodType> = {};
  for (const variable of varsFile.variables) {
    schemaShape[variable.name] = evaluateSchema(variable.schema);
  }

  let schema: z.ZodType = z.object(schemaShape);

  // 5. Apply @refine constraints
  if (varsFile.refines.length > 0) {
    schema = applyRefines(schema as z.ZodObject<z.ZodRawShape>, varsFile.refines);
  }

  // 6. Build input object (raw strings -> Zod handles coercion)
  const input: Record<string, unknown> = {};
  for (const [name, value] of decrypted) {
    input[name] = value;
  }

  // 7. Validate
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      variable: issue.path[0]?.toString() ?? "unknown",
      message: issue.message,
    }));
    throw new ValidationError(
      formatValidationError(issues, env),
      issues,
    );
  }

  // 8. Wrap string values in Redacted
  const config: Record<string, any> = {};
  for (const [name, value] of Object.entries(result.data as Record<string, unknown>)) {
    if (typeof value === "string") {
      config[name] = new Redacted(value);
    } else {
      config[name] = value;
    }
  }

  return config;
}

function formatValidationError(
  issues: Array<{ variable: string; message: string }>,
  env: string,
): string {
  const lines = [`vars: environment validation failed (${issues.length} error${issues.length > 1 ? "s" : ""})`];
  lines.push("");
  for (const issue of issues) {
    lines.push(`  ${issue.variable} (@${env}):`);
    lines.push(`    ${issue.message}`);
    lines.push("");
  }
  return lines.join("\n");
}
