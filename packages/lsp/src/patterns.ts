/**
 * Matches a variable declaration line in a .vars file.
 * Captures: (1) the variable name, (2) the Zod schema expression.
 *
 * Example: `DATABASE_URL  z.string().url()` -> ["DATABASE_URL", "z.string().url()"]
 */
export const VAR_DECL_RE = /^([A-Z_][A-Z0-9_]*)\s{2,}(z\..+)$/;
