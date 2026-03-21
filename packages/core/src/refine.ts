import type { z } from "zod";
import type { Refine } from "./types.js";
import { VarsError } from "./errors.js";

const ENV_REF_PATTERN = /env\.([A-Z][A-Z0-9_]*)/g;

export function extractReferencedVars(expression: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(ENV_REF_PATTERN.source, "g");
  while ((match = pattern.exec(expression)) !== null) {
    matches.add(match[1]);
  }
  return [...matches];
}

export function applyRefines<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  refines: Refine[],
): z.ZodType {
  let result: z.ZodType = schema;

  for (const refine of refines) {
    const fn = compileRefineExpression(refine.expression, refine.line);
    result = result.refine(fn, {
      message: refine.message,
    });
  }

  return result;
}

function compileRefineExpression(expression: string, line: number): (env: Record<string, unknown>) => boolean {
  // Safety: only allow env.VARNAME references, comparison operators, logical operators, literals
  const dangerous = ["process", "require", "import", "eval", "Function", "globalThis", "window", "fetch"];
  for (const word of dangerous) {
    if (expression.includes(word)) {
      throw new VarsError(`@refine at line ${line}: contains forbidden keyword "${word}"`);
    }
  }

  try {
    const fn = new Function("env", `"use strict"; return (${expression})(env)`);
    return (env: Record<string, unknown>) => fn(env) as boolean;
  } catch (err) {
    throw new VarsError(
      `@refine at line ${line}: invalid expression — ${(err as Error).message}`,
    );
  }
}
