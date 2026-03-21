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
