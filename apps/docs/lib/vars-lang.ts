import type { LanguageRegistration } from 'shiki';

/**
 * Custom TextMate grammar for the .vars DSL.
 *
 * Tokens:
 * - variable.other.vars     → Variable names (DATABASE_URL, PORT)
 * - support.function.vars   → Zod schema calls (z.string().url())
 * - keyword.control.vars    → Environment decorators (@dev, @prod, @default)
 * - entity.name.tag.vars    → Directives (@refine, @extends)
 * - comment.line.vars       → Comments (# ...)
 * - string.quoted.vars      → Strings ("...")
 * - constant.numeric.vars   → Numbers
 * - keyword.operator.vars   → Operators (=, =>, ||, &&, !==, ===)
 * - variable.parameter.vars → Metadata (@description, @owner, @expires, @deprecated)
 * - storage.type.vars       → Encrypted values (enc:v1:...)
 */
export const varsLanguage: LanguageRegistration = {
  name: 'vars',
  scopeName: 'source.vars',
  patterns: [
    // Comments
    {
      match: '#.*$',
      name: 'comment.line.hash.vars',
    },
    // Directives: @refine, @extends
    {
      match: '@(refine|extends)\\b',
      name: 'entity.name.tag.vars',
    },
    // Metadata: @description, @owner, @expires, @deprecated
    {
      match: '@(description|owner|expires|deprecated)\\b',
      name: 'variable.parameter.vars',
    },
    // Environment decorators: @dev, @prod, @staging, @default, etc.
    {
      match: '@\\w+',
      name: 'keyword.control.vars',
    },
    // Encrypted values
    {
      match: 'enc:v1:[a-zA-Z0-9:._]+',
      name: 'storage.type.vars',
    },
    // Strings
    {
      match: '"[^"]*"',
      name: 'string.quoted.double.vars',
    },
    // Zod chain: z.something().something()
    {
      match: 'z\\.[a-zA-Z().]+',
      name: 'support.function.vars',
    },
    // Arrow operator
    {
      match: '=>',
      name: 'keyword.operator.arrow.vars',
    },
    // Comparison/logical operators
    {
      match: '!==|===|\\|\\||&&|!',
      name: 'keyword.operator.vars',
    },
    // Assignment
    {
      match: '=',
      name: 'keyword.operator.assignment.vars',
    },
    // Numbers
    {
      match: '\\b\\d+\\b',
      name: 'constant.numeric.vars',
    },
    // Boolean
    {
      match: '\\b(true|false)\\b',
      name: 'constant.language.vars',
    },
    // Variable names at start of line (UPPER_CASE identifiers)
    {
      match: '^[A-Z][A-Z0-9_]+',
      name: 'variable.other.vars',
    },
    // env.SOMETHING property access
    {
      match: '\\benv\\.[A-Z_]+',
      name: 'variable.other.property.vars',
    },
  ],
  repository: {},
};
