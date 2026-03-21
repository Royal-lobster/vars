import type { z } from "zod";
import vm from "node:vm";
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
  // Validate expression is an arrow function shape
  if (!expression.trim().startsWith("(env)") && !expression.trim().startsWith("env =>")) {
    throw new VarsError(`@refine at line ${line}: must be an arrow function starting with (env) =>`);
  }

  try {
    // Pre-compile the function in a sandbox
    const sandbox = { compiledFn: undefined as unknown };
    vm.runInNewContext(`compiledFn = ${expression}`, sandbox, {
      timeout: 100,
      filename: "vars-refine-eval",
    });

    if (typeof sandbox.compiledFn !== "function") {
      throw new Error("Expression did not produce a function");
    }

    const fn = sandbox.compiledFn as (env: Record<string, unknown>) => boolean;

    // Return a wrapper that runs the function in a sandbox too
    return (env: Record<string, unknown>) => {
      const execSandbox = { fn, env, result: false };
      vm.runInNewContext(`result = fn(env)`, execSandbox, { timeout: 100 });
      return execSandbox.result as boolean;
    };
  } catch (err) {
    if (err instanceof VarsError) throw err;
    throw new VarsError(
      `@refine at line ${line}: invalid expression — ${(err as Error).message}`,
    );
  }
}
