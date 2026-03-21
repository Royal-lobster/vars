import type { Variable } from "./types.js";

/**
 * Resolution order (highest -> lowest priority):
 * 1. Variable's @<env> value
 * 2. Variable's @default value
 * 3. undefined (parent resolution handled by extends.ts before this runs)
 *
 * Zod .default() is handled at validation time by Zod itself.
 */
export function resolveValue(variable: Variable, env: string): string | undefined {
  // 1. Exact env match
  const envValue = variable.values.find((v) => v.env === env);
  if (envValue) return envValue.value;

  // 2. Default fallback
  const defaultValue = variable.values.find((v) => v.env === "default");
  if (defaultValue) return defaultValue.value;

  // 3. No value found
  return undefined;
}

export function resolveAllValues(
  variables: Variable[],
  env: string,
): Map<string, string | undefined> {
  const resolved = new Map<string, string | undefined>();
  for (const variable of variables) {
    resolved.set(variable.name, resolveValue(variable, env));
  }
  return resolved;
}
