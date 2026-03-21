import { readFileSync } from "node:fs";

/**
 * Matches an environment-value line like `  @dev = someValue`.
 * Two capture groups: (1) the prefix up to and including `= `, (2) the value.
 */
export const ENV_VALUE_LINE = /^([ \t]+@[\w-]+[ \t]+=[ \t]+)(.+)$/;

/**
 * Same pattern but with a single capture group for the value only.
 * Useful when you only need to inspect the value, not rewrite the line.
 */
export const ENV_VALUE_LINE_VALUE_ONLY = /^[ \t]+@[\w-]+[ \t]+=[ \t]+(.+)$/;

/**
 * Marker string injected into pre-commit hooks by `vars hook install`.
 * Used to detect whether the hook is already installed.
 */
export const HOOK_MARKER = "# vars: auto-encrypt before commit";

/**
 * Count the number of environment-value lines in a .vars file.
 */
export function countVariables(filePath: string): number {
  const content = readFileSync(filePath, "utf8");
  return content.split("\n").filter((line) => ENV_VALUE_LINE.test(line)).length;
}
