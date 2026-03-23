import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tokenize, TokenType, type Token } from "../tokenizer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function tok(src: string): Token[] {
  return tokenize(src);
}

function types(src: string): TokenType[] {
  return tok(src)
    .filter((t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF)
    .map((t) => t.type);
}

function values(src: string): string[] {
  return tok(src)
    .filter((t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF)
    .map((t) => t.value);
}

// ── 1. env declaration ────────────────────────────────────────────────────────

describe("tokenizer", () => {
  it("tokenizes env(dev, staging, prod)", () => {
    const tokens = tok("env(dev, staging, prod)").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({ type: TokenType.KEYWORD, value: "env" });
    expect(tokens[1]).toMatchObject({ type: TokenType.LPAREN });
    expect(tokens[2]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "dev",
    });
    expect(tokens[3]).toMatchObject({ type: TokenType.COMMA });
    expect(tokens[4]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "staging",
    });
    expect(tokens[5]).toMatchObject({ type: TokenType.COMMA });
    expect(tokens[6]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "prod",
    });
    expect(tokens[7]).toMatchObject({ type: TokenType.RPAREN });
  });

  // ── 2. variable declaration with schema ───────────────────────────────────

  it("tokenizes public PORT : z.number()... = 3000", () => {
    const src = "public PORT : z.number().int().min(1).max(65535) = 3000";
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({ type: TokenType.KEYWORD, value: "public" });
    expect(tokens[1]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "PORT",
    });
    expect(tokens[2]).toMatchObject({ type: TokenType.COLON });
    expect(tokens[3]).toMatchObject({
      type: TokenType.SCHEMA,
      value: "z.number().int().min(1).max(65535)",
    });
    expect(tokens[4]).toMatchObject({ type: TokenType.EQUALS });
    expect(tokens[5]).toMatchObject({ type: TokenType.NUMBER, value: "3000" });
  });

  // ── 3. double-quoted strings ──────────────────────────────────────────────

  it("tokenizes double-quoted strings", () => {
    const tokens = tok('APP_NAME = "my-app"').filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[2]).toMatchObject({ type: TokenType.STRING, value: "my-app" });
  });

  it("tokenizes single-quoted strings", () => {
    const tokens = tok("APP_NAME = 'hello world'").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[2]).toMatchObject({
      type: TokenType.STRING,
      value: "hello world",
    });
  });

  // ── 4. encrypted values ───────────────────────────────────────────────────

  it("tokenizes encrypted values starting with enc:", () => {
    const tokens = tok("prod = enc:v2:aes256gcm-det:abc123:def456:ghi789").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[2]).toMatchObject({
      type: TokenType.ENCRYPTED,
      value: "enc:v2:aes256gcm-det:abc123:def456:ghi789",
    });
  });

  // ── 5. env blocks with braces ─────────────────────────────────────────────

  it("tokenizes env block with braces", () => {
    const src = `DATABASE_URL : z.string().url() {
  dev = "postgres://localhost/myapp"
}`;
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "DATABASE_URL",
    });
    expect(tokens[1]).toMatchObject({ type: TokenType.COLON });
    expect(tokens[2]).toMatchObject({
      type: TokenType.SCHEMA,
      value: "z.string().url()",
    });
    expect(tokens[3]).toMatchObject({ type: TokenType.LBRACE });
    expect(tokens[4]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "dev",
    });
    expect(tokens[5]).toMatchObject({ type: TokenType.EQUALS });
    expect(tokens[6]).toMatchObject({
      type: TokenType.STRING,
      value: "postgres://localhost/myapp",
    });
    expect(tokens[7]).toMatchObject({ type: TokenType.RBRACE });
  });

  // ── 6. comments ───────────────────────────────────────────────────────────

  it("captures comments as COMMENT tokens", () => {
    const tokens = tok("# This is a comment").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({
      type: TokenType.COMMENT,
      value: "# This is a comment",
    });
  });

  // ── 7. nested schemas with braces ─────────────────────────────────────────

  it("handles nested schemas: z.object({ enabled: z.boolean() })", () => {
    const src = "FLAG : z.object({ enabled: z.boolean() }) = {}";
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    const schemaToken = tokens.find((t) => t.type === TokenType.SCHEMA);
    expect(schemaToken).toBeDefined();
    expect(schemaToken!.value).toBe("z.object({ enabled: z.boolean() })");
  });

  // ── 8. triple-quoted strings ──────────────────────────────────────────────

  it("tokenizes triple-quoted strings with Kotlin-style indentation stripping", () => {
    const src = `CERT : z.string() {
  prod = """
    -----BEGIN CERTIFICATE-----
    MIIBxTCCAWug
    -----END CERTIFICATE-----
  """
}`;
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    const tripleStr = tokens.find((t) => t.type === TokenType.TRIPLE_STRING);
    expect(tripleStr).toBeDefined();
    // Closing """ is at column 2 (0-indexed), so N=2, strip 2 chars from each line
    // Content lines start with 4 spaces, stripping 2 leaves 2 spaces
    expect(tripleStr!.value).toContain("-----BEGIN CERTIFICATE-----");
    expect(tripleStr!.value).toContain("-----END CERTIFICATE-----");
    expect(tripleStr!.value).toContain("MIIBxTCCAWug");
    // Lines should have had 2 chars stripped (closing """ is at col 2)
    // Original content has 4 leading spaces, after stripping 2 → 2 spaces
    const lines = tripleStr!.value.split("\n");
    expect(lines[0]).toMatch(/^  -----BEGIN/);
  });

  // ── 9. arrow operator ─────────────────────────────────────────────────────

  it("tokenizes => as ARROW", () => {
    const tokens = tok("when region = eu => true").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    const arrow = tokens.find((t) => t.type === TokenType.ARROW);
    expect(arrow).toBeDefined();
    expect(arrow!.value).toBe("=>");
  });

  // ── 10. comparison operators ──────────────────────────────────────────────

  it("tokenizes comparison operators as COMPARISON tokens", () => {
    const ops = ["==", "!=", ">=", "<=", ">", "<"];
    for (const op of ops) {
      const tokens = tok(`a ${op} b`).filter(
        (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
      );
      const cmp = tokens.find((t) => t.type === TokenType.COMPARISON);
      expect(cmp, `Expected COMPARISON for operator "${op}"`).toBeDefined();
      expect(cmp!.value).toBe(op);
    }
  });

  it("distinguishes = (EQUALS) from == (COMPARISON) and => (ARROW)", () => {
    const tokens = tok("a = b == c => d").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[1]).toMatchObject({ type: TokenType.EQUALS, value: "=" });
    expect(tokens[3]).toMatchObject({ type: TokenType.COMPARISON, value: "==" });
    expect(tokens[5]).toMatchObject({ type: TokenType.ARROW, value: "=>" });
  });

  // ── 11. full fixture file ──────────────────────────────────────────────────

  it("tokenizes the full fixture file without ERROR tokens", () => {
    const fixturePath = join(__dirname, "fixtures", "simple.vars");
    const src = readFileSync(fixturePath, "utf8");
    const tokens = tokenize(src);

    const errors = tokens.filter((t) => t.type === TokenType.ERROR);
    expect(errors).toHaveLength(0);

    // Verify key tokens appear
    const keywords = tokens
      .filter((t) => t.type === TokenType.KEYWORD)
      .map((t) => t.value);
    expect(keywords).toContain("env");
    expect(keywords).toContain("public");

    const identifiers = tokens
      .filter((t) => t.type === TokenType.IDENTIFIER)
      .map((t) => t.value);
    expect(identifiers).toContain("APP_NAME");
    expect(identifiers).toContain("DATABASE_URL");
    expect(identifiers).toContain("LOG_LEVEL");

    const encrypted = tokens.filter((t) => t.type === TokenType.ENCRYPTED);
    expect(encrypted).toHaveLength(1);
    expect(encrypted[0].value).toBe(
      "enc:v2:aes256gcm-det:abc123:def456:ghi789",
    );
  });

  // ── 12. boolean literals ──────────────────────────────────────────────────

  it("tokenizes boolean literals true and false", () => {
    const trueToks = tok("true").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );
    expect(trueToks[0]).toMatchObject({
      type: TokenType.BOOLEAN,
      value: "true",
    });

    const falseToks = tok("false").filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );
    expect(falseToks[0]).toMatchObject({
      type: TokenType.BOOLEAN,
      value: "false",
    });
  });

  // ── 13. use statement ─────────────────────────────────────────────────────

  it('tokenizes use "path" { pick: [NAME] }', () => {
    const src = 'use "../../shared/database.vars" { pick: [STRIPE_KEY] }';
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({ type: TokenType.KEYWORD, value: "use" });
    expect(tokens[1]).toMatchObject({
      type: TokenType.STRING,
      value: "../../shared/database.vars",
    });
    expect(tokens[2]).toMatchObject({ type: TokenType.LBRACE });
    expect(tokens[3]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "pick",
    });
    expect(tokens[4]).toMatchObject({ type: TokenType.COLON });
    expect(tokens[5]).toMatchObject({ type: TokenType.LBRACKET });
    expect(tokens[6]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "STRIPE_KEY",
    });
    expect(tokens[7]).toMatchObject({ type: TokenType.RBRACKET });
    expect(tokens[8]).toMatchObject({ type: TokenType.RBRACE });
  });

  // ── 14. when clause ───────────────────────────────────────────────────────

  it("tokenizes when region = eu => true", () => {
    const src = "when region = eu => true";
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({ type: TokenType.KEYWORD, value: "when" });
    expect(tokens[1]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "region",
    });
    expect(tokens[2]).toMatchObject({ type: TokenType.EQUALS, value: "=" });
    expect(tokens[3]).toMatchObject({
      type: TokenType.IDENTIFIER,
      value: "eu",
    });
    expect(tokens[4]).toMatchObject({ type: TokenType.ARROW, value: "=>" });
    expect(tokens[5]).toMatchObject({ type: TokenType.BOOLEAN, value: "true" });
  });

  // ── Line/col tracking ────────────────────────────────────────────────────

  it("tracks line and col for tokens", () => {
    const src = "env(dev)\nAPP_NAME = 1";
    const tokens = tok(src).filter(
      (t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF,
    );

    expect(tokens[0]).toMatchObject({ line: 1, col: 1 }); // env
    expect(tokens[4]).toMatchObject({ line: 2, col: 1 }); // APP_NAME
  });
});
