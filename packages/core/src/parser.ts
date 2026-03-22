import { tokenize, TokenType, type Token } from "./tokenizer.js";
import { ParseError } from "./errors.js";
import type {
  ParseResult,
  ParseWarning,
  VarsFile,
  Param,
  Import,
  ImportFilter,
  Declaration,
  VariableDecl,
  GroupDecl,
  Value,
  LiteralValue,
  EncryptedValue,
  InterpolatedValue,
  EnvBlockValue,
  ConditionalValue,
  EnvEntry,
  WhenClause,
  Metadata,
  Check,
  CheckPredicate,
  CheckExpr,
} from "./types.js";

// ── Token cursor ────────────────────────────────────────────────────────────

class TokenCursor {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly filePath?: string,
  ) {}

  peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1]!;
  }

  advance(): Token {
    const t = this.tokens[this.pos]!;
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  match(type: TokenType, value?: string): Token | null {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      return this.advance();
    }
    return null;
  }

  expect(type: TokenType, value?: string): Token {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      return this.advance();
    }
    throw this.error(
      `Expected ${TokenType[type]}${value !== undefined ? ` '${value}'` : ""}, got ${TokenType[t.type]} '${t.value}'`,
    );
  }

  check(type: TokenType, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  isEOF(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  error(msg: string): ParseError {
    const t = this.peek();
    return new ParseError(msg, t.line, this.filePath);
  }

  line(): number {
    return this.peek().line;
  }

  /** Skip NEWLINE and COMMENT tokens */
  skipTrivia(): void {
    while (
      !this.isEOF() &&
      (this.peek().type === TokenType.NEWLINE || this.peek().type === TokenType.COMMENT)
    ) {
      this.advance();
    }
  }

  /** Skip to next newline or EOF (for error recovery) */
  skipToNewline(): void {
    while (
      !this.isEOF() &&
      this.peek().type !== TokenType.NEWLINE
    ) {
      this.advance();
    }
  }

  /** Skip NEWLINEs (but not comments) */
  skipNewlines(): void {
    while (!this.isEOF() && this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }
  }
}

// ── Parser ──────────────────────────────────────────────────────────────────

export function parse(source: string, filePath?: string): ParseResult {
  const tokens = tokenize(source);
  const cursor = new TokenCursor(tokens, filePath);
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  const ast: VarsFile = {
    envs: [],
    params: [],
    imports: [],
    declarations: [],
    checks: [],
  };

  cursor.skipTrivia();

  // Parse top-level constructs
  while (!cursor.isEOF()) {
    try {
      const t = cursor.peek();

      if (t.type === TokenType.NEWLINE || t.type === TokenType.COMMENT) {
        cursor.skipTrivia();
        continue;
      }

      if (t.type === TokenType.KEYWORD) {
        switch (t.value) {
          case "env":
            if (ast.envs.length > 0) {
              errors.push(new ParseError("Duplicate env declaration", t.line, filePath));
              cursor.skipToNewline();
            } else {
              ast.envs = parseEnvDecl(cursor);
            }
            break;
          case "param":
            ast.params.push(parseParam(cursor));
            break;
          case "use":
            ast.imports.push(parseImport(cursor));
            break;
          case "group":
            ast.declarations.push(parseGroup(cursor, ast.envs, errors, filePath));
            break;
          case "public":
            ast.declarations.push(parseVariable(cursor, ast.envs, errors, filePath));
            break;
          case "check":
            ast.checks.push(parseCheck(cursor));
            break;
          default:
            errors.push(new ParseError(`Unexpected keyword '${t.value}'`, t.line, filePath));
            cursor.skipToNewline();
            break;
        }
      } else if (t.type === TokenType.IDENTIFIER) {
        ast.declarations.push(parseVariable(cursor, ast.envs, errors, filePath));
      } else {
        errors.push(new ParseError(`Unexpected token '${t.value}'`, t.line, filePath));
        cursor.skipToNewline();
      }

      cursor.skipTrivia();
    } catch (e) {
      if (e instanceof ParseError) {
        errors.push(e);
        cursor.skipToNewline();
        cursor.skipTrivia();
      } else {
        throw e;
      }
    }
  }

  return { ast, errors, warnings };
}

// ── env(...) ────────────────────────────────────────────────────────────────

function parseEnvDecl(cursor: TokenCursor): string[] {
  cursor.expect(TokenType.KEYWORD, "env");
  cursor.expect(TokenType.LPAREN);
  const envs: string[] = [];

  while (!cursor.isEOF() && !cursor.check(TokenType.RPAREN)) {
    const id = cursor.expect(TokenType.IDENTIFIER);
    envs.push(id.value);
    if (!cursor.match(TokenType.COMMA)) break;
  }

  cursor.expect(TokenType.RPAREN);
  return envs;
}

// ── param ... ───────────────────────────────────────────────────────────────

function parseParam(cursor: TokenCursor): Param {
  const line = cursor.line();
  cursor.expect(TokenType.KEYWORD, "param");
  const name = cursor.expect(TokenType.IDENTIFIER).value;

  cursor.expect(TokenType.COLON);

  // expect "enum" identifier (not a z. schema)
  // The tokenizer won't produce a SCHEMA here since it's "enum" not "z."
  cursor.expect(TokenType.IDENTIFIER, "enum");
  cursor.expect(TokenType.LPAREN);

  const values: string[] = [];
  while (!cursor.isEOF() && !cursor.check(TokenType.RPAREN)) {
    const v = cursor.expect(TokenType.IDENTIFIER);
    values.push(v.value);
    if (!cursor.match(TokenType.COMMA)) break;
  }
  cursor.expect(TokenType.RPAREN);

  cursor.expect(TokenType.EQUALS);
  const defaultValue = cursor.expect(TokenType.IDENTIFIER).value;

  return { name, values, defaultValue, line };
}

// ── use "..." ───────────────────────────────────────────────────────────────

function parseImport(cursor: TokenCursor): Import {
  const line = cursor.line();
  cursor.expect(TokenType.KEYWORD, "use");
  const path = cursor.expect(TokenType.STRING).value;

  let filter: ImportFilter | undefined;

  if (cursor.match(TokenType.LBRACE)) {
    // { pick: [...] } or { omit: [...] }
    const kindToken = cursor.peek();
    if (
      kindToken.type === TokenType.IDENTIFIER &&
      (kindToken.value === "pick" || kindToken.value === "omit")
    ) {
      const kind = cursor.advance().value as "pick" | "omit";
      cursor.expect(TokenType.COLON);
      // Note: the COLON might try to schema-capture, but since next isn't "z." it won't
      cursor.expect(TokenType.LBRACKET);
      const names: string[] = [];
      while (!cursor.isEOF() && !cursor.check(TokenType.RBRACKET)) {
        names.push(cursor.expect(TokenType.IDENTIFIER).value);
        if (!cursor.match(TokenType.COMMA)) break;
      }
      cursor.expect(TokenType.RBRACKET);
      filter = { kind, names };
    }
    cursor.expect(TokenType.RBRACE);
  }

  return { path, filter, line };
}

// ── group name { ... } ──────────────────────────────────────────────────────

function parseGroup(
  cursor: TokenCursor,
  envs: string[],
  errors: ParseError[],
  filePath?: string,
): GroupDecl {
  const line = cursor.line();
  cursor.expect(TokenType.KEYWORD, "group");
  const name = cursor.expect(TokenType.IDENTIFIER).value;
  cursor.expect(TokenType.LBRACE);
  cursor.skipTrivia();

  const declarations: VariableDecl[] = [];

  while (!cursor.isEOF() && !cursor.check(TokenType.RBRACE)) {
    try {
      declarations.push(parseVariable(cursor, envs, errors, filePath));
    } catch (e) {
      if (e instanceof ParseError) {
        errors.push(e);
        cursor.skipToNewline();
      } else {
        throw e;
      }
    }
    cursor.skipTrivia();
  }

  cursor.expect(TokenType.RBRACE);
  return { kind: "group", name, declarations, line };
}

// ── Variable declaration ────────────────────────────────────────────────────

function parseVariable(
  cursor: TokenCursor,
  envs: string[],
  errors: ParseError[],
  filePath?: string,
): VariableDecl {
  const line = cursor.line();
  let isPublic = false;

  if (cursor.match(TokenType.KEYWORD, "public")) {
    isPublic = true;
  }

  const name = cursor.expect(TokenType.IDENTIFIER).value;

  // Optional schema after colon
  let schema: string | null = null;
  if (cursor.match(TokenType.COLON)) {
    // If tokenizer captured a SCHEMA token, consume it
    if (cursor.check(TokenType.SCHEMA)) {
      schema = cursor.advance().value;
    }
  }

  // Optional default value after =
  let defaultValue: Value | null = null;
  if (cursor.match(TokenType.EQUALS)) {
    defaultValue = parseValue(cursor);
  }

  // Optional block { ... }
  let blockValue: Value | null = null;
  if (cursor.check(TokenType.LBRACE)) {
    blockValue = parseBlock(cursor, envs, errors, filePath);
  }

  // Merge default + block
  let value: Value | null;
  if (blockValue && defaultValue) {
    // Variable has both a default and an env block override
    // Add the default as the base and merge the block entries
    if (blockValue.kind === "env_block") {
      // Keep the env_block, the default is the variable-level default
      // We'll add a special "default" entry concept — but in the AST,
      // the default is the variable's own default for envs not covered.
      // For now, represent this as the env_block value (the resolver handles defaults).
      // Actually, looking at types.ts, VariableDecl has a single `value` field.
      // When there's both a default and env overrides, we still use env_block
      // but store the default separately. Since the type doesn't support this directly,
      // we'll use the env_block and the resolver will handle default logic.
      //
      // Re-reading the spec: "The value from `=` becomes the default, the env block entries override per-env."
      // The cleanest approach: store the env_block as the value, and add a `default` entry.
      const envBlock = blockValue as EnvBlockValue;
      envBlock.entries.unshift({
        env: "*",
        value: defaultValue,
        line: defaultValue.line,
      });
      value = envBlock;
    } else {
      value = blockValue;
    }
  } else if (blockValue) {
    value = blockValue;
  } else {
    value = defaultValue;
  }

  // Optional metadata after ( ... )
  let metadata: Metadata | null = null;
  if (cursor.check(TokenType.LPAREN)) {
    metadata = parseMetadata(cursor);
  }

  return {
    kind: "variable",
    name,
    public: isPublic,
    schema,
    value,
    metadata,
    line,
  };
}

// ── Block parsing { ... } ───────────────────────────────────────────────────
// Determines whether this is an env_block or conditional based on contents.

function parseBlock(
  cursor: TokenCursor,
  envs: string[],
  errors: ParseError[],
  filePath?: string,
): Value {
  const line = cursor.line();
  cursor.expect(TokenType.LBRACE);
  cursor.skipTrivia();

  const envEntries: EnvEntry[] = [];
  const whenClauses: WhenClause[] = [];
  let fallback: Value | undefined;
  let hasBareEnv = false;

  while (!cursor.isEOF() && !cursor.check(TokenType.RBRACE)) {
    const t = cursor.peek();

    if (t.type === TokenType.KEYWORD && t.value === "when") {
      const whenResult = parseWhenClause(cursor, envs, errors, filePath);
      whenClauses.push(whenResult);
    } else if (t.type === TokenType.KEYWORD && t.value === "else") {
      cursor.advance(); // consume 'else'
      cursor.expect(TokenType.ARROW);
      fallback = parseValue(cursor);
    } else if (t.type === TokenType.IDENTIFIER) {
      // env = value entry
      const envName = t.value;
      const entryLine = t.line;
      cursor.advance();
      cursor.expect(TokenType.EQUALS);
      const val = parseValue(cursor);

      // Validate env name
      if (envs.length > 0 && !envs.includes(envName)) {
        errors.push(
          new ParseError(
            `Undeclared environment '${envName}'`,
            entryLine,
            filePath,
          ),
        );
      }

      envEntries.push({ env: envName, value: val, line: entryLine });
      hasBareEnv = true;
    } else if (t.type === TokenType.KEYWORD && t.value === "env") {
      // 'env' inside check-like context — skip for now, shouldn't be in variable blocks
      errors.push(new ParseError(`Unexpected 'env' keyword in block`, t.line, filePath));
      cursor.skipToNewline();
    } else {
      errors.push(new ParseError(`Unexpected token '${t.value}' in block`, t.line, filePath));
      cursor.skipToNewline();
    }

    cursor.skipTrivia();
  }

  cursor.expect(TokenType.RBRACE);

  // Determine block type
  if (hasBareEnv) {
    // env_block — may also contain when-qualified entries
    // When clauses in an env_block get flattened as additional EnvEntry items with when conditions
    for (const wc of whenClauses) {
      if (Array.isArray(wc.result)) {
        for (const entry of wc.result) {
          envEntries.push({
            ...entry,
            when: { param: wc.param, value: wc.value },
          });
        }
      }
    }
    return { kind: "env_block", entries: envEntries, line } satisfies EnvBlockValue;
  } else if (whenClauses.length > 0 || fallback !== undefined) {
    // Pure conditional
    return {
      kind: "conditional",
      whens: whenClauses,
      fallback,
      line,
    } satisfies ConditionalValue;
  }

  // Empty block
  return { kind: "env_block", entries: [], line } satisfies EnvBlockValue;
}

// ── when clause ─────────────────────────────────────────────────────────────

function parseWhenClause(
  cursor: TokenCursor,
  envs: string[],
  errors: ParseError[],
  filePath?: string,
): WhenClause {
  const line = cursor.line();
  cursor.expect(TokenType.KEYWORD, "when");
  const param = cursor.expect(TokenType.IDENTIFIER).value;
  cursor.expect(TokenType.EQUALS);
  const value = cursor.expect(TokenType.IDENTIFIER).value;

  // Two forms:
  // 1) when param = val => result_value
  // 2) when param = val { env = value; ... }
  if (cursor.match(TokenType.ARROW)) {
    const result = parseValue(cursor);
    return { param, value, result, line };
  } else if (cursor.check(TokenType.LBRACE)) {
    cursor.expect(TokenType.LBRACE);
    cursor.skipTrivia();

    const entries: EnvEntry[] = [];
    while (!cursor.isEOF() && !cursor.check(TokenType.RBRACE)) {
      const envName = cursor.expect(TokenType.IDENTIFIER).value;
      const entryLine = cursor.line();
      cursor.expect(TokenType.EQUALS);
      const val = parseValue(cursor);

      if (envs.length > 0 && !envs.includes(envName)) {
        errors.push(
          new ParseError(
            `Undeclared environment '${envName}'`,
            entryLine,
            filePath,
          ),
        );
      }

      entries.push({ env: envName, value: val, line: entryLine });
      cursor.skipTrivia();
    }

    cursor.expect(TokenType.RBRACE);
    return { param, value, result: entries, line };
  }

  throw cursor.error("Expected '=>' or '{' after when condition");
}

// ── Value parsing ───────────────────────────────────────────────────────────

function parseValue(cursor: TokenCursor): Value {
  const t = cursor.peek();

  // Encrypted value
  if (t.type === TokenType.ENCRYPTED) {
    cursor.advance();
    return { kind: "encrypted", raw: t.value, line: t.line } satisfies EncryptedValue;
  }

  // Triple-quoted string
  if (t.type === TokenType.TRIPLE_STRING) {
    cursor.advance();
    return { kind: "literal", value: t.value, line: t.line } satisfies LiteralValue;
  }

  // String value — check for interpolation
  if (t.type === TokenType.STRING) {
    cursor.advance();
    return parseStringValue(t);
  }

  // Number
  if (t.type === TokenType.NUMBER) {
    cursor.advance();
    const num = t.value.includes(".") ? parseFloat(t.value) : parseInt(t.value, 10);
    return { kind: "literal", value: num, line: t.line } satisfies LiteralValue;
  }

  // Boolean
  if (t.type === TokenType.BOOLEAN) {
    cursor.advance();
    return {
      kind: "literal",
      value: t.value === "true",
      line: t.line,
    } satisfies LiteralValue;
  }

  // Array value
  if (t.type === TokenType.LBRACKET) {
    return parseArrayValue(cursor);
  }

  throw cursor.error(`Expected value, got ${TokenType[t.type]} '${t.value}'`);
}

function parseStringValue(token: Token): Value {
  const interpolationRegex = /\$\{([^}]+)\}/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = interpolationRegex.exec(token.value)) !== null) {
    refs.push(match[1]!);
  }

  if (refs.length > 0) {
    return {
      kind: "interpolated",
      template: token.value,
      refs,
      line: token.line,
    } satisfies InterpolatedValue;
  }

  return {
    kind: "literal",
    value: token.value,
    line: token.line,
  } satisfies LiteralValue;
}

function parseArrayValue(cursor: TokenCursor): LiteralValue {
  const line = cursor.line();
  cursor.expect(TokenType.LBRACKET);

  const items: unknown[] = [];
  while (!cursor.isEOF() && !cursor.check(TokenType.RBRACKET)) {
    const t = cursor.peek();
    if (t.type === TokenType.STRING) {
      cursor.advance();
      items.push(t.value);
    } else if (t.type === TokenType.NUMBER) {
      cursor.advance();
      items.push(t.value.includes(".") ? parseFloat(t.value) : parseInt(t.value, 10));
    } else if (t.type === TokenType.BOOLEAN) {
      cursor.advance();
      items.push(t.value === "true");
    } else if (t.type === TokenType.LBRACKET) {
      const nested = parseArrayValue(cursor);
      items.push(nested.value);
    } else {
      break;
    }
    cursor.match(TokenType.COMMA);
  }

  cursor.expect(TokenType.RBRACKET);
  return { kind: "literal", value: items, line };
}

// ── Metadata parsing ( ... ) ────────────────────────────────────────────────

function parseMetadata(cursor: TokenCursor): Metadata {
  cursor.expect(TokenType.LPAREN);
  cursor.skipTrivia();

  const metadata: Metadata = {};

  while (!cursor.isEOF() && !cursor.check(TokenType.RPAREN)) {
    const key = cursor.expect(TokenType.IDENTIFIER).value;
    cursor.expect(TokenType.EQUALS);

    if (key === "tags") {
      cursor.expect(TokenType.LBRACKET);
      const tags: string[] = [];
      while (!cursor.isEOF() && !cursor.check(TokenType.RBRACKET)) {
        tags.push(cursor.expect(TokenType.IDENTIFIER).value);
        cursor.match(TokenType.COMMA);
      }
      cursor.expect(TokenType.RBRACKET);
      metadata.tags = tags;
    } else if (key === "description" || key === "owner" || key === "see" || key === "deprecated") {
      metadata[key] = cursor.expect(TokenType.STRING).value;
    } else if (key === "expires") {
      // Date: tokenizes as NUMBER-ERROR-NUMBER-ERROR-NUMBER
      // We need to reconstruct the date string
      metadata.expires = parseDateValue(cursor);
    }

    cursor.skipTrivia();
  }

  cursor.expect(TokenType.RPAREN);
  return metadata;
}

function parseDateValue(cursor: TokenCursor): string {
  // Date like 2026-09-01 tokenizes as: NUMBER "2026", ERROR "-", NUMBER "09", ERROR "-", NUMBER "01"
  let date = cursor.expect(TokenType.NUMBER).value;
  if (cursor.check(TokenType.ERROR) && cursor.peek().value === "-") {
    date += cursor.advance().value; // -
    date += cursor.expect(TokenType.NUMBER).value; // month
    if (cursor.check(TokenType.ERROR) && cursor.peek().value === "-") {
      date += cursor.advance().value; // -
      date += cursor.expect(TokenType.NUMBER).value; // day
    }
  }
  return date;
}

// ── Check block parsing ─────────────────────────────────────────────────────

function parseCheck(cursor: TokenCursor): Check {
  const line = cursor.line();
  cursor.expect(TokenType.KEYWORD, "check");
  const description = cursor.expect(TokenType.STRING).value;
  cursor.expect(TokenType.LBRACE);
  cursor.skipTrivia();

  const predicates: CheckPredicate[] = [];

  while (!cursor.isEOF() && !cursor.check(TokenType.RBRACE)) {
    const pred = parseCheckPredicate(cursor);
    predicates.push(pred);
    cursor.skipTrivia();
  }

  cursor.expect(TokenType.RBRACE);
  return { description, predicates, line };
}

// ── Check expression parsing ────────────────────────────────────────────────
// Grammar:
//   predicate := implication | or_expr
//   implication := or_expr "=>" or_expr
//   or_expr := and_expr ("or" and_expr)*
//   and_expr := not_expr ("and" not_expr)*
//   not_expr := "not" not_expr | comparison
//   comparison := expr ("==" | "!=" | ...) expr
//   expr := literal | var_ref | function_call

function parseCheckPredicate(cursor: TokenCursor): CheckPredicate {
  return parseImplication(cursor);
}

function parseImplication(cursor: TokenCursor): CheckPredicate {
  const left = parseOr(cursor);

  if (cursor.match(TokenType.ARROW)) {
    const right = parseOr(cursor);
    return { kind: "implication", antecedent: left, consequent: right };
  }

  return left;
}

function parseOr(cursor: TokenCursor): CheckPredicate {
  let left = parseAnd(cursor);

  while (cursor.check(TokenType.KEYWORD, "or")) {
    cursor.advance();
    const right = parseAnd(cursor);
    left = { kind: "logical", op: "or", left, right };
  }

  return left;
}

function parseAnd(cursor: TokenCursor): CheckPredicate {
  let left = parseNot(cursor);

  while (cursor.check(TokenType.KEYWORD, "and")) {
    cursor.advance();
    const right = parseNot(cursor);
    left = { kind: "logical", op: "and", left, right };
  }

  return left;
}

function parseNot(cursor: TokenCursor): CheckPredicate {
  if (cursor.check(TokenType.KEYWORD, "not")) {
    cursor.advance();
    const operand = parseNot(cursor);
    return { kind: "not", operand };
  }

  return parseComparison(cursor);
}

function parseComparison(cursor: TokenCursor): CheckPredicate {
  const left = parseCheckExpr(cursor);

  if (cursor.check(TokenType.COMPARISON)) {
    const op = cursor.advance().value as "==" | "!=" | ">" | "<" | ">=" | "<=";
    const right = parseCheckExpr(cursor);
    return { kind: "comparison", left, op, right };
  }

  // If it's a bare function call, wrap it
  if (left.kind === "function_expr") {
    return {
      kind: "function_call",
      name: left.name as "defined" | "matches" | "one_of" | "starts_with",
      args: left.args,
    };
  }

  // Bare variable reference — treat as a truthy check (comparison with true)
  return {
    kind: "comparison",
    left,
    op: "==",
    right: { kind: "boolean_literal", value: true },
  };
}

function parseCheckExpr(cursor: TokenCursor): CheckExpr {
  const t = cursor.peek();

  // String literal
  if (t.type === TokenType.STRING) {
    cursor.advance();
    return { kind: "string_literal", value: t.value };
  }

  // Number literal
  if (t.type === TokenType.NUMBER) {
    cursor.advance();
    return {
      kind: "number_literal",
      value: t.value.includes(".") ? parseFloat(t.value) : parseInt(t.value, 10),
    };
  }

  // Boolean literal
  if (t.type === TokenType.BOOLEAN) {
    cursor.advance();
    return { kind: "boolean_literal", value: t.value === "true" };
  }

  // Array literal
  if (t.type === TokenType.LBRACKET) {
    cursor.advance();
    const values: CheckExpr[] = [];
    while (!cursor.isEOF() && !cursor.check(TokenType.RBRACKET)) {
      values.push(parseCheckExpr(cursor));
      cursor.match(TokenType.COMMA);
    }
    cursor.expect(TokenType.RBRACKET);
    return { kind: "array_literal", values };
  }

  // Keyword functions: defined, matches, one_of, starts_with, length
  if (
    t.type === TokenType.KEYWORD &&
    (t.value === "defined" ||
      t.value === "matches" ||
      t.value === "one_of" ||
      t.value === "starts_with" ||
      t.value === "length")
  ) {
    cursor.advance();
    cursor.expect(TokenType.LPAREN);
    const args: CheckExpr[] = [];
    while (!cursor.isEOF() && !cursor.check(TokenType.RPAREN)) {
      args.push(parseCheckExpr(cursor));
      cursor.match(TokenType.COMMA);
    }
    cursor.expect(TokenType.RPAREN);
    return { kind: "function_expr", name: t.value as "length", args };
  }

  // Variable reference (IDENTIFIER or "env" keyword used as var ref)
  if (t.type === TokenType.IDENTIFIER || (t.type === TokenType.KEYWORD && t.value === "env")) {
    cursor.advance();
    return { kind: "var_ref", name: t.value };
  }

  throw cursor.error(
    `Expected check expression, got ${TokenType[t.type]} '${t.value}'`,
  );
}

// ── Semicolon handling ──────────────────────────────────────────────────────
// The DSL doesn't use semicolons, but some env block entries may use them
// (the grammar example shows `dev = "sk_test"; prod = enc:v2:...` inline)
// For now, treat newlines as statement separators.
