// ── Token types ───────────────────────────────────────────────────────────────

export enum TokenType {
  IDENTIFIER,
  KEYWORD,
  SCHEMA,
  STRING,
  TRIPLE_STRING,
  NUMBER,
  BOOLEAN,
  ENCRYPTED,
  LBRACE,
  RBRACE,
  LPAREN,
  RPAREN,
  LBRACKET,
  RBRACKET,
  EQUALS,
  COLON,
  COMMA,
  DOT,
  ARROW,
  COMPARISON, // ==, !=, >, <, >=, <=
  COMMENT,
  NEWLINE,
  EOF,
  ERROR,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// ── Keywords ──────────────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  "env",
  "param",
  "use",
  "group",
  "public",
  "check",
  "when",
  "else",
  "and",
  "or",
  "not",
  "defined",
  "matches",
  "one_of",
  "length",
  "starts_with",
]);

// ── Tokenizer state ───────────────────────────────────────────────────────────

class Tokenizer {
  private pos = 0;
  private line = 1;
  private lineStart = 0;
  private readonly tokens: Token[] = [];

  constructor(private readonly src: string) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private col(): number {
    return this.pos - this.lineStart + 1;
  }

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? "";
  }

  private advance(): string {
    const ch = this.src[this.pos++]!;
    if (ch === "\n") {
      this.line++;
      this.lineStart = this.pos;
    }
    return ch;
  }

  private skipSpaces(): void {
    while (
      this.pos < this.src.length &&
      (this.src[this.pos] === " " ||
        this.src[this.pos] === "\t" ||
        this.src[this.pos] === "\r")
    ) {
      this.pos++;
    }
  }

  private addToken(
    type: TokenType,
    value: string,
    tokenLine: number,
    tokenCol: number,
  ): void {
    this.tokens.push({ type, value, line: tokenLine, col: tokenCol });
  }

  // ── Schema capture ───────────────────────────────────────────────────────────
  // Called immediately after emitting a COLON, when the next non-space text
  // starts with `z.`. Captures until depth-0 terminator: `=`, `{`, or newline.
  private trySchemaCapture(): void {
    // Peek ahead (past spaces) to see if schema follows
    let lookahead = this.pos;
    while (
      lookahead < this.src.length &&
      (this.src[lookahead] === " " || this.src[lookahead] === "\t")
    ) {
      lookahead++;
    }

    if (
      this.src[lookahead] !== "z" ||
      this.src[lookahead + 1] !== "."
    ) {
      return; // not a schema
    }

    // Skip spaces
    this.skipSpaces();

    const schemaLine = this.line;
    const schemaCol = this.col();
    const start = this.pos;

    let depth = 0;

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]!;

      if (depth === 0 && ch === "{") {
        // A `{` at depth 0 is NOT part of the schema — it opens an env block
        break;
      } else if (ch === "(" || ch === "[" || ch === "{") {
        depth++;
        this.pos++;
      } else if (ch === ")" || ch === "]" || ch === "}") {
        if (depth === 0) break; // unmatched close — belongs to outer context
        depth--;
        this.pos++;
      } else if (depth === 0 && (ch === "=" || ch === "\n" || ch === "#")) {
        // End of schema
        break;
      } else if (ch === '"' || ch === "'") {
        // String literal inside schema (e.g. z.enum(["debug"]))
        const quote = ch;
        this.pos++;
        while (this.pos < this.src.length && this.src[this.pos] !== quote) {
          if (this.src[this.pos] === "\\") this.pos++;
          this.pos++;
        }
        if (this.pos < this.src.length) this.pos++; // consume closing quote
      } else {
        this.pos++;
      }
    }

    const raw = this.src.slice(start, this.pos).trimEnd();
    this.addToken(TokenType.SCHEMA, raw, schemaLine, schemaCol);
  }

  // ── Triple-string capture ────────────────────────────────────────────────────
  // Called after consuming the opening `"""`.
  // Strips Kotlin-style indentation: find column (0-indexed) of closing `"""`,
  // strip exactly that many characters from the start of each content line.
  private captureTripleString(startLine: number, startCol: number): void {
    const contentStart = this.pos;
    const end = this.src.indexOf('"""', this.pos);

    if (end === -1) {
      // Unterminated — emit error and consume rest
      this.addToken(
        TokenType.ERROR,
        '"""' + this.src.slice(contentStart),
        startLine,
        startCol,
      );
      this.pos = this.src.length;
      return;
    }

    const rawContent = this.src.slice(contentStart, end);

    // Determine 0-indexed column of the closing """
    let closingLineStart = end;
    while (closingLineStart > 0 && this.src[closingLineStart - 1] !== "\n") {
      closingLineStart--;
    }
    const closingCol = end - closingLineStart; // 0-indexed column of `"""`

    // Walk pos up to and past closing """ updating line tracking
    for (let i = contentStart; i < end + 3; i++) {
      if (this.src[i] === "\n") {
        this.line++;
        this.lineStart = i + 1;
      }
    }
    this.pos = end + 3;

    // Strip indentation from content
    const lines = rawContent.split("\n");

    const stripped = lines.map((l) => {
      if (l.length === 0) return l;
      let charsStripped = 0;
      let i = 0;
      while (i < l.length && charsStripped < closingCol) {
        if (l[i] === " " || l[i] === "\t") {
          charsStripped++;
          i++;
        } else {
          // Not enough leading whitespace — strip what we can
          return l.trimStart();
        }
      }
      return l.slice(i);
    });

    // Remove first line if it's blank (opening `"""` followed by newline)
    if (stripped.length > 0 && stripped[0]!.trim() === "") {
      stripped.shift();
    }
    // Remove last line if it's blank (closing `"""` on its own line)
    if (stripped.length > 0 && stripped[stripped.length - 1]!.trim() === "") {
      stripped.pop();
    }

    this.addToken(
      TokenType.TRIPLE_STRING,
      stripped.join("\n"),
      startLine,
      startCol,
    );
  }

  // ── Main tokenize loop ───────────────────────────────────────────────────────

  tokenize(): Token[] {
    while (this.pos < this.src.length) {
      this.skipSpaces();

      if (this.pos >= this.src.length) break;

      const ch = this.src[this.pos]!;
      const tokenLine = this.line;
      const tokenCol = this.col();

      // Newline
      if (ch === "\n") {
        this.advance();
        this.addToken(TokenType.NEWLINE, "\n", tokenLine, tokenCol);
        continue;
      }

      // Comment
      if (ch === "#") {
        let comment = "";
        while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
          comment += this.advance();
        }
        this.addToken(TokenType.COMMENT, comment, tokenLine, tokenCol);
        continue;
      }

      // Triple-quoted string — must check before single "
      if (ch === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
        this.pos += 3;
        this.captureTripleString(tokenLine, tokenCol);
        continue;
      }

      // Single/double quoted string
      if (ch === '"' || ch === "'") {
        const quote = ch;
        this.advance(); // consume opening quote
        let str = "";
        while (
          this.pos < this.src.length &&
          this.src[this.pos] !== quote &&
          this.src[this.pos] !== "\n"
        ) {
          if (this.src[this.pos] === "\\") {
            this.advance(); // skip backslash
            const escaped = this.advance();
            switch (escaped) {
              case "n":  str += "\n"; break;
              case "t":  str += "\t"; break;
              case "r":  str += "\r"; break;
              default:   str += escaped;
            }
          } else {
            str += this.advance();
          }
        }
        if (this.pos < this.src.length && this.src[this.pos] === quote) {
          this.advance(); // consume closing quote
        }
        this.addToken(TokenType.STRING, str, tokenLine, tokenCol);
        continue;
      }

      // Operators — handle = variants first
      if (ch === "=") {
        if (this.peek(1) === "=") {
          this.pos += 2;
          this.addToken(TokenType.COMPARISON, "==", tokenLine, tokenCol);
        } else if (this.peek(1) === ">") {
          this.pos += 2;
          this.addToken(TokenType.ARROW, "=>", tokenLine, tokenCol);
        } else {
          this.pos++;
          this.addToken(TokenType.EQUALS, "=", tokenLine, tokenCol);
        }
        continue;
      }

      if (ch === "!") {
        if (this.peek(1) === "=") {
          this.pos += 2;
          this.addToken(TokenType.COMPARISON, "!=", tokenLine, tokenCol);
        } else {
          this.pos++;
          this.addToken(TokenType.ERROR, "!", tokenLine, tokenCol);
        }
        continue;
      }

      if (ch === ">") {
        if (this.peek(1) === "=") {
          this.pos += 2;
          this.addToken(TokenType.COMPARISON, ">=", tokenLine, tokenCol);
        } else {
          this.pos++;
          this.addToken(TokenType.COMPARISON, ">", tokenLine, tokenCol);
        }
        continue;
      }

      if (ch === "<") {
        if (this.peek(1) === "=") {
          this.pos += 2;
          this.addToken(TokenType.COMPARISON, "<=", tokenLine, tokenCol);
        } else {
          this.pos++;
          this.addToken(TokenType.COMPARISON, "<", tokenLine, tokenCol);
        }
        continue;
      }

      // Colon — may be followed by a schema (z.xxx)
      if (ch === ":") {
        this.pos++;
        this.addToken(TokenType.COLON, ":", tokenLine, tokenCol);
        this.trySchemaCapture();
        continue;
      }

      // Single-char punctuation
      if (ch === "{") { this.pos++; this.addToken(TokenType.LBRACE,   "{", tokenLine, tokenCol); continue; }
      if (ch === "}") { this.pos++; this.addToken(TokenType.RBRACE,   "}", tokenLine, tokenCol); continue; }
      if (ch === "(") { this.pos++; this.addToken(TokenType.LPAREN,   "(", tokenLine, tokenCol); continue; }
      if (ch === ")") { this.pos++; this.addToken(TokenType.RPAREN,   ")", tokenLine, tokenCol); continue; }
      if (ch === "[") { this.pos++; this.addToken(TokenType.LBRACKET, "[", tokenLine, tokenCol); continue; }
      if (ch === "]") { this.pos++; this.addToken(TokenType.RBRACKET, "]", tokenLine, tokenCol); continue; }
      if (ch === ",") { this.pos++; this.addToken(TokenType.COMMA,    ",", tokenLine, tokenCol); continue; }
      if (ch === ".") { this.pos++; this.addToken(TokenType.DOT,      ".", tokenLine, tokenCol); continue; }

      // Numbers
      if (ch >= "0" && ch <= "9") {
        let num = "";
        while (
          this.pos < this.src.length &&
          ((this.src[this.pos]! >= "0" && this.src[this.pos]! <= "9") ||
            this.src[this.pos] === ".")
        ) {
          num += this.advance();
        }
        this.addToken(TokenType.NUMBER, num, tokenLine, tokenCol);
        continue;
      }

      // Identifiers, keywords, booleans, encrypted values
      if (isIdentStart(ch)) {
        let ident = "";
        while (this.pos < this.src.length && isIdentCont(this.src[this.pos]!)) {
          ident += this.advance();
        }

        // Encrypted: `enc:...`
        if (ident === "enc" && this.pos < this.src.length && this.src[this.pos] === ":") {
          let enc = ident;
          while (
            this.pos < this.src.length &&
            this.src[this.pos] !== " " &&
            this.src[this.pos] !== "\t" &&
            this.src[this.pos] !== "\n" &&
            this.src[this.pos] !== "\r" &&
            this.src[this.pos] !== "#"
          ) {
            enc += this.advance();
          }
          this.addToken(TokenType.ENCRYPTED, enc, tokenLine, tokenCol);
          continue;
        }

        // Boolean literals
        if (ident === "true" || ident === "false") {
          this.addToken(TokenType.BOOLEAN, ident, tokenLine, tokenCol);
          continue;
        }

        // Keywords
        if (KEYWORDS.has(ident)) {
          this.addToken(TokenType.KEYWORD, ident, tokenLine, tokenCol);
          continue;
        }

        this.addToken(TokenType.IDENTIFIER, ident, tokenLine, tokenCol);
        continue;
      }

      // Unknown character — emit error token
      this.addToken(TokenType.ERROR, ch, tokenLine, tokenCol);
      this.pos++;
    }

    this.addToken(TokenType.EOF, "", this.line, this.col());
    return this.tokens;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function tokenize(src: string): Token[] {
  return new Tokenizer(src).tokenize();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentCont(ch: string): boolean {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9") || ch === "-";
}
