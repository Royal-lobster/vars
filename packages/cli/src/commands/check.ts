import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import {
  parse,
  resolveValue,
  evaluateSchema,
  validateValue,
  applyRefines,
  isEncrypted,
} from "@vars/core";
import { z } from "zod";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";

export interface CheckError {
  variable: string;
  env?: string;
  message: string;
  expected?: string;
  got?: string;
}

export interface CheckWarning {
  variable: string;
  message: string;
  detail?: string;
}

export interface CheckResult {
  valid: boolean;
  errors: CheckError[];
  warnings: CheckWarning[];
}

export default defineCommand({
  meta: {
    name: "check",
    description: "Validate all values against schemas",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to validate",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file, env: args.env });
    const result = checkVarsFile(ctx.varsFilePath, ctx.env);

    if (result.valid && result.warnings.length === 0) {
      output.success(`vars check passed (${ctx.env})`);
    } else if (result.valid && result.warnings.length > 0) {
      output.success(`vars check passed with ${result.warnings.length} warning(s)`);
      output.validationErrors([], result.warnings);
    } else {
      output.validationErrors(result.errors, result.warnings);
      process.exit(1);
    }
  },
});

/**
 * Check a .vars file: validate all values against schemas and check metadata.
 */
export function checkVarsFile(filePath: string, env: string): CheckResult {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);
  const errors: CheckError[] = [];
  const warnings: CheckWarning[] = [];

  const resolvedValues: Record<string, unknown> = {};

  for (const variable of parsed.variables) {
    checkMetadataWarnings(variable.name, variable.metadata, warnings);

    const rawValue = resolveValue(variable, env);

    // Skip encrypted values
    if (rawValue !== undefined && isEncrypted(rawValue)) {
      continue;
    }

    const isOptional = variable.schema.includes(".optional()");
    if (rawValue === undefined && !isOptional) {
      errors.push({
        variable: variable.name,
        env,
        message: `Missing required value. Add @${env} value or set @default`,
      });
      continue;
    }

    if (rawValue !== undefined) {
      const result = validateValue(variable.schema, rawValue);
      if (result.success) {
        resolvedValues[variable.name] = result.value;
      } else {
        for (const issue of result.issues) {
          errors.push({
            variable: variable.name,
            env,
            expected: variable.schema,
            got: `string of length ${rawValue.length}`,
            message: issue.message,
          });
        }
      }
    } else {
      resolvedValues[variable.name] = undefined;
    }
  }

  // Cross-variable @refine validation
  if (parsed.refines.length > 0 && errors.length === 0) {
    try {
      const schemaShape: Record<string, z.ZodType> = {};
      for (const v of parsed.variables) {
        schemaShape[v.name] = evaluateSchema(v.schema);
      }
      const baseSchema = z.object(schemaShape);
      const refined = applyRefines(baseSchema, parsed.refines);
      const refineResult = refined.safeParse(resolvedValues);
      if (!refineResult.success) {
        for (const issue of refineResult.error.issues) {
          errors.push({
            variable: "@refine",
            message: issue.message,
          });
        }
      }
    } catch (err) {
      errors.push({
        variable: "@refine",
        message: `Refinement evaluation failed: ${(err as Error).message}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function checkMetadataWarnings(
  name: string,
  metadata: { expires?: string; deprecated?: string },
  warnings: CheckWarning[],
): void {
  if (metadata.deprecated) {
    warnings.push({
      variable: name,
      message: `Deprecated: "${metadata.deprecated}"`,
      detail: "Migrate usages and remove this variable",
    });
  }

  if (metadata.expires) {
    const expiryDate = new Date(metadata.expires);
    const now = new Date();
    const daysUntil = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntil < 0) {
      warnings.push({
        variable: name,
        message: `Secret expired on ${metadata.expires} (${Math.abs(daysUntil)} days ago)`,
        detail: "Rotate this secret immediately",
      });
    } else if (daysUntil <= 30) {
      warnings.push({
        variable: name,
        message: `Expires in ${daysUntil} days (${metadata.expires})`,
        detail: "Rotate this secret before expiry",
      });
    }
  }
}
