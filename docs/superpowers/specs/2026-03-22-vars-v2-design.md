# vars v2 — Complete Design Specification

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Ground-up rewrite of the vars DSL, encryption model, parser, codegen, and CLI

## Overview

vars is a typed environment variable manager for TypeScript projects. v2 is a complete rewrite that introduces a new DSL syntax, inline SOPS-style encryption with deterministic IVs, multi-file composition, parameterized conditionals, and a platform-aware codegen system.

**Target audience:** 2–15 person TypeScript teams that are too small for HashiCorp Vault, too security-conscious for plaintext `.env`, and too type-safety-obsessed for unvalidated config.

**Key constraint:** PIN-protected encryption keys ensure that AI coding agents cannot access secrets without a human entering the PIN.

---

## 1. Package Architecture

```
packages/
  core/        Pure TS — parser, resolver, validator, crypto, codegen
               ZERO native deps, ZERO fs calls. Takes string input, returns typed output.
               Works in any JS runtime (Node, Deno, Bun, browser build tools).

  node/        Node-specific: file reader, use-chain resolver, key manager (Argon2, keytar)
               Imports @vars/core for parsing/validation.

  cli/         CLI commands (citty + clack). Imports @vars/node.

  lsp/         Language Server Protocol — updated for v2 syntax.

  vscode/      VS Code extension — updated TextMate grammar.

apps/
  docs/        Documentation site (existing, updated for v2).
```

### Published Packages

| Package | What users install | Purpose |
|---|---|---|
| `vars` | `npm i -D vars` | CLI tool — the only thing most users need |

`@vars/core` and `@vars/node` are internal workspace packages, never published separately. The generated `.ts` file has no runtime dependency on any vars package — it is self-contained (Zod + inlined Redacted class).

### Core Principle

`@vars/core` is a pure computation engine. It takes strings as input and returns structured data as output. It never touches the filesystem, never uses native addons, and works in any JS runtime. This is what makes it safe for serverless bundlers and test environments.

`@vars/node` is the glue that reads files from disk, resolves `use` chains by walking the filesystem, manages encryption keys (Argon2, OS keychain), and calls into `@vars/core` for the actual work.

---

## 2. v2 Syntax — Complete Grammar

### File Header

```
env(dev, staging, prod)
param region : enum(us, eu, ap) = us
```

- `env()` declares valid environment names. Any undeclared env name used in the file is a parse error (catches typos like `@stagng`).
- `param` declares parameterized dimensions with an enum type and default value. Optional.

### Imports

```
use "../../shared/database.vars"
use "../../shared/secrets.vars" { pick: [STRIPE_KEY, SENTRY_DSN] }
use "../../shared/infra.vars" { omit: [INTERNAL_DEBUG] }
```

- Paths are relative to the importing file's directory.
- `pick` narrows the import to listed names only.
- `omit` excludes specific names.
- Conflicts (same variable from two imports) are parse errors.
- Local declarations shadow imports (intentional override, no error).

### Variable Declarations

```
public APP_NAME = "my-app"                                    # inferred z.string()
public PORT : z.number().int().min(1).max(65535) = 3000       # schema + default
DATABASE_URL : z.string().url()                                # no default, required
DEBUG : z.boolean() = false                                    # default value
```

- Colon (`:`) separates name from schema (TypeScript-style type annotation).
- Equals (`=`) separates from default value.
- Both are optional: bare `NAME = "value"` infers `z.string()`.
- `public` keyword prefix: value is never encrypted, generated type is plain (not `Redacted<string>`).
- Variables without `public` are secret by default: encrypted in committed files, generated as `Redacted<string>`.

### Environment-Specific Values

```
DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = "postgres://staging.db:5432/myapp"
  prod    = enc:v2:aes256gcm-det:abc...:def...:ghi...
}
```

- Braces `{}` contain per-environment values.
- Environment names must match the `env()` declaration.
- A variable with a single value across all environments stays flat (no braces).

### Interpolation

```
DB_URL : z.string().url() = "postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}"
```

- Standard `${}` syntax.
- References resolve per-environment (late-binding): when resolved for `prod`, `${DB_HOST}` pulls prod's value.
- Escape literal `${` with `\${`.
- References resolve within the same file first, then in `use`-imported files.
- Interpolation happens at resolution time (during `vars run`, `vars export`, `vars check`), not at parse time. `vars show` decrypts encrypted literals in-place but does NOT resolve interpolation — the template string `${DB_PASS}` remains as-is in the unlocked file, showing the referenced variable name rather than its value.

### Multi-line Values

```
TLS_CERT : z.string() {
  prod = """
    -----BEGIN CERTIFICATE-----
    MIIBxTCCAWug...
    -----END CERTIFICATE-----
  """
}
```

- Triple-quoted strings (Python/Kotlin/Swift convention).
- Leading whitespace stripped using the column position of the closing `"""` as the baseline. Every line has that many leading characters removed. (This is the Kotlin convention, not minimum-indentation.)
- Interpolation works inside triple-quoted strings. Use `r"""..."""` to suppress.

### Groups

```
group stripe {
  SECRET_KEY : z.string() {
    dev  = "sk_example_placeholder"
    prod = enc:v2:aes256gcm-det:...
  }
  public PUBLISHABLE_KEY : z.string() {
    dev  = "pk_example_placeholder"
    prod = "pk_live_real"
  }
}
```

- Groups are purely organizational — they prefix generated env var names (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`) and create nested TypeScript interfaces.
- Inside a group, unqualified names resolve locally. Cross-group uses dot notation: `${stripe.SECRET_KEY}`.
- No nested groups. Flat groups only.
- `public` is per-variable only, never on the `group` keyword itself. Each variable within a group independently declares its own visibility.

### Metadata

```
JWT_SECRET : z.string().min(64) {
  dev  = "dev-placeholder"
  prod = enc:v2:aes256gcm-det:...
} (
  description = "Signs auth tokens"
  owner = "auth-team"
  expires = 2026-09-01
  deprecated = "Migrating to asymmetric keys by Q3"
  tags = [auth, critical]
)
```

- Parenthesized annotation blocks after the value.
- All metadata uses `key = value` syntax — no inconsistent forms.
- Known keys: `description`, `owner`, `expires`, `deprecated`, `tags`, `see`.
- Unknown keys produce a parse warning (forward-compatible).

### Conditionals

```
public GDPR_MODE : z.boolean() {
  when region = eu => true
  else => false
}

DATABASE_URL : z.string().url() {
  dev = "postgres://localhost/myapp"
  when region = us { prod = "postgres://us-prod.db/myapp" }
  when region = eu { prod = "postgres://eu-prod.db/myapp" }
}
```

- `when` matches one param value. No compound expressions (`when region = eu and tier = premium` is not supported — use file composition for the matrix).
- `else` provides a fallback.
- Params are resolved at runtime (`vars run --param region=eu`), not at codegen time.
- Params affect values, not types. `vars gen` does not accept `--param`.
- **Missing env values:** If a variable uses `when` blocks and an env has no value for the matched param (e.g., `staging` is not assigned), it falls back to: (1) a non-conditional value for that env if one exists, (2) the `else` clause if present, (3) undefined — which causes a validation error for required fields. This is consistent with the standard env resolution: missing = undefined = error if required.

### Arrays and Objects

```
public CORS_ORIGINS : z.array(z.string().url()) {
  dev  = ["http://localhost:3000"]
  prod = ["https://app.example.com", "https://admin.example.com"]
}

FEATURE_FLAGS : z.object({
  new_checkout: z.boolean(),
  max_upload_mb: z.number()
}) = {
  new_checkout: true,
  max_upload_mb: 50
}
```

- JSON-like syntax for array and object values.
- Serialized to environment variables as JSON strings.

### Check Blocks

```
check "TLS required in prod" {
  env == "prod" => defined(TLS_CERT)
}

check "Test Stripe keys in dev" {
  env == "dev" => starts_with(stripe.SECRET_KEY, "sk_example_")
}

check "Pool bounds" {
  database.POOL_SIZE >= 5 and database.POOL_SIZE <= 200
}
```

- Restricted expression language — not JavaScript. No eval, no `new Function`.
- Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not`, `=>` (implication).
- Built-in functions: `defined()`, `matches()`, `one_of()`, `length()`, `starts_with()`.
- Special variables: `env` (current environment), param names (e.g., `region`).
- Variable references: `VAR_NAME` (top-level), `group.VAR_NAME` (grouped).
- Checks run during `vars check`, `vars run` (before spawning). Not during `vars gen`.

### Comments

```
# This is a comment
public APP_NAME = "my-app"  # Inline comment
```

---

## 3. Encryption Model

### Inline Partial Encryption (SOPS-style)

One file per config. Secret values are encrypted inline. Structure (names, schemas, metadata, comments) is always plaintext. Unlocked files are **renamed** to `*.unlocked.vars` (gitignored) as a structural safety layer — even if a developer forgets to run `vars hide`, plaintext secrets cannot reach git.

**Committed (locked) state — `config.vars`:**
```
# @vars-state locked
env(dev, staging, prod)

public APP_NAME = "my-app"
STRIPE_KEY : z.string() {
  dev  = "sk_example_placeholder"
  prod = enc:v2:aes256gcm-det:abc...:def...:ghi...
}
```

**Working (unlocked) state after `vars show` — `config.unlocked.vars` (gitignored):**
```
# @vars-state unlocked
env(dev, staging, prod)

public APP_NAME = "my-app"
STRIPE_KEY : z.string() {
  dev  = "sk_example_placeholder"
  prod = "sk_live_aBcDeFgHiJkLmNoPqRsTuVwX"
}
```

Only one file exists at a time — never both. `vars show` renames `.vars` to `.unlocked.vars` then decrypts. `vars hide` encrypts then renames `.unlocked.vars` back to `.vars`.

### Deterministic IVs (HMAC-derived)

```
IV = HMAC-SHA256(key, "STRIPE_KEY@prod:" + plaintext)[0:12]
```

Same (key + variable + environment + value) → same ciphertext → **zero diff if nothing changed**. `git blame` is preserved. Merge conflicts only happen on actual semantic conflicts.

Format: `enc:v2:aes256gcm-det:<iv>:<ciphertext>:<tag>`

**Clarification:** This is standard AES-256-GCM (same as v1) but with HMAC-derived nonces instead of random nonces. It is NOT AES-GCM-SIV (RFC 8452), which is a distinct algorithm using POLYVAL. The `-det` suffix indicates "deterministic nonce derivation." The security properties are: same plaintext + same key + same context = same ciphertext (nonce reuse is safe because the nonce is derived from the plaintext itself, so identical nonces always correspond to identical plaintexts).

### State Tracking

- **Primary signal:** Filename — `*.vars` = locked, `*.unlocked.vars` = unlocked.
- **Secondary signal:** `# @vars-state locked/unlocked` header — human-readable indicator, used by `vars ls` display. The filename is the authoritative source of lock state.

### What Is Never Encrypted

- `public` values — plaintext always.
- Variable names, schemas, metadata, comments, `use` directives, `check` blocks — always plaintext (structure is always readable).

### Safety Layers

1. **Gitignore** — `*.unlocked.vars` is added to `.gitignore` by `vars init`. Even if the user forgets to hide, git will not track unlocked files.
2. **Pre-commit hook** — checks if any `*.unlocked.vars` files are staged (fast filename check instead of reading file content). Blocks commit with "run `vars hide` first". Requires human PIN entry to encrypt. No auto-encrypt — the PIN-as-human-gatekeeper design is intentional to prevent AI agents from accessing secrets.
3. **State header** — `# @vars-state locked/unlocked` is a secondary human-readable signal. No longer the primary safety mechanism.

### Key Management

- One key per repo at `.vars/key` (default location).
- PIN-protected via Argon2id KDF (memory-hard, brute-force resistant).
- `VARS_KEY` env var for CI (base64-encoded master key, bypasses PIN).
- `vars gen` does NOT need the key — it reads structure without decrypting values.

---

## 4. Parser Design

### Architecture

Recursive descent parser with a simple tokenizer. Not regex-per-line (v1). Not a parser generator (PEG, ANTLR). Hand-written TypeScript.

### Tokenizer

Produces tokens:

| Token | Examples |
|---|---|
| `IDENTIFIER` | `APP_NAME`, `database`, `region` |
| `KEYWORD` | `env`, `param`, `use`, `group`, `public`, `check`, `when`, `else` |
| `SCHEMA` | `z.string().url()` (opaque string between `:` and `=`/`{`, with nesting-aware capture for schemas containing `{}`/`()`) |
| `STRING` | `"hello"`, `'hello'` |
| `TRIPLE_STRING` | `"""..."""` |
| `NUMBER` | `3000`, `365` |
| `BOOLEAN` | `true`, `false` |
| `ENCRYPTED` | `enc:v2:aes256gcm-det:...` |
| `LBRACE`, `RBRACE` | `{`, `}` |
| `LPAREN`, `RPAREN` | `(`, `)` |
| `LBRACKET`, `RBRACKET` | `[`, `]` |
| `EQUALS`, `COLON`, `COMMA`, `DOT`, `ARROW` | `=`, `:`, `,`, `.`, `=>` |
| `COMMENT` | `# ...` |
| `NEWLINE` | line breaks |

### AST

```typescript
type VarsFile = {
  envs: string[]
  params: Param[]
  imports: Import[]
  declarations: Declaration[]
  checks: Check[]
}

type Declaration = VariableDecl | GroupDecl

type VariableDecl = {
  name: string
  public: boolean
  schema: string | null          // null = inferred z.string()
  value: Value
  metadata: Metadata | null
  line: number
}

type GroupDecl = {
  name: string
  declarations: VariableDecl[]   // no nested groups
  line: number
}

type Value =
  | { kind: 'literal'; value: string | number | boolean | unknown[] | Record<string, unknown> }
  | { kind: 'encrypted'; raw: string }
  | { kind: 'interpolated'; template: string; refs: string[] }
  | { kind: 'env_block'; entries: EnvEntry[] }
  | { kind: 'conditional'; whens: WhenClause[]; fallback?: Value }

type EnvEntry = {
  env: string
  value: Value
  when?: WhenClause
}

type WhenClause = {
  param: string
  value: string
  result: Value | EnvEntry[]
}

type Check = {
  description: string
  predicates: Predicate[]
  line: number
}
```

### AST Mapping Rules

The parser maps syntax to `Value` kinds as follows:

- `VAR = "value"` → `{ kind: 'literal' }`
- `VAR = "hello ${NAME}"` → `{ kind: 'interpolated' }`
- `VAR = enc:v2:...` → `{ kind: 'encrypted' }`
- `VAR { dev = "a"; prod = "b" }` → `{ kind: 'env_block' }` with plain `EnvEntry` items
- `VAR { when region = eu => "x"; else => "y" }` → `{ kind: 'conditional' }` (pure param switching, no env dimension)
- `VAR { dev = "a"; when region = us { prod = "b" } }` → `{ kind: 'env_block' }` where some entries have `when` clauses attached

The key distinction: if the block contains ANY bare `env = value` entries, it is an `env_block` (which may also contain `when`-qualified env entries). If it contains ONLY `when`/`else` clauses with no env names, it is a `conditional`.

### Zod Schema Handling

Zod schemas are **opaque strings** — the parser captures everything between `:` and `=`/`{` as a raw string. No Zod grammar parsing. The tokenizer must track parenthesis and brace nesting depth to correctly capture schemas like `z.object({ key: z.string() })` that contain `{`/`}` characters.

Validation happens later via `new Function("z", "return " + schema)`. The **primary security mechanism** is a static allowlist check before eval: verify the string starts with `z.`, has balanced parentheses, and contains only known Zod method names (e.g., `string`, `number`, `object`, `array`, `enum`, `coerce`, `min`, `max`, `url`, `email`, `optional`, `nullable`, `default`, `transform`, `refine`, `pipe`). Unknown method names are rejected. The keyword blacklist (`eval`, `require`, `process`, etc.) is defense-in-depth, not the primary boundary.

This catches typos like `z.strng()` with a friendly error at parse time rather than a raw JS TypeError at eval time.

### Error Recovery

On a syntax error, skip to the next line starting at column 0 (next top-level declaration) and continue parsing. Collect all errors and report them together. This is critical for the LSP — diagnostics should cover the whole file, not just the first error.

---

## 5. Codegen

### Generated File

`vars gen <file>` produces a `<name>.generated.ts` file next to the entry point `.vars` file. It resolves all `use` imports and produces the complete type for the full merged variable set.

```
services/api/
  vars.vars              # entry point
  vars.generated.ts      # generated — contains ALL resolved vars (own + imported)
```

The generated file is self-contained: Zod + inlined Redacted class. No runtime dependency on any vars package.

### Generated Code Structure

```typescript
// vars.generated.ts
// @generated by vars — do not edit
// @vars-source-hash: a1b2c3d4

import { z } from 'zod'

class Redacted<T> {
  #value: T
  constructor(value: T) { this.#value = value }
  unwrap(): T { return this.#value }
  toString() { return '<redacted>' }
  toJSON() { return '<redacted>' }
  [Symbol.for('nodejs.util.inspect.custom')]() { return '<redacted>' }
}

const schema = z.object({
  APP_NAME: z.string(),
  PORT: z.number().int().min(1).max(65535),
  DATABASE_URL: z.string().url(),
  stripe: z.object({
    SECRET_KEY: z.string(),
    PUBLISHABLE_KEY: z.string(),
  }),
})

export type Vars = {
  APP_NAME: string                    // public → plain
  PORT: number                        // public → plain
  DATABASE_URL: Redacted<string>      // secret → wrapped
  stripe: {
    SECRET_KEY: Redacted<string>      // secret → wrapped
    PUBLISHABLE_KEY: string           // public → plain
  }
}

export type ClientVars = Pick<Vars, 'APP_NAME' | 'PORT'>

function parseVars(source: Record<string, string | undefined>): Vars {
  // coerce, validate via schema, wrap secrets in Redacted
}

export const vars: Vars = parseVars(process.env)
export const clientVars: ClientVars = { /* public subset */ }
```

### Type Rules

| Variable kind | Generated type |
|---|---|
| `public` + `z.string()` | `string` |
| `public` + `z.number()` | `number` |
| `public` + `z.boolean()` | `boolean` |
| `public` + `z.enum([...])` | `"a" \| "b" \| "c"` |
| secret + `z.string()` (or inferred) | `Redacted<string>` |
| secret + `z.number()` | `number` (deliberate trade-off: numbers/booleans cannot leak meaningful secrets through `toString()` or `console.log`, and wrapping them in `Redacted` would break arithmetic/comparison operators. The encryption-at-rest protection still applies in the `.vars` file.) |
| secret + `z.boolean()` | `boolean` (same rationale as number) |
| `z.array(...)` | Parsed from JSON, typed array |
| `z.object({...})` | Parsed from JSON, typed object |
| `.optional()` | `fieldName?: Type` |
| Groups | Nested object in type, flattened `GROUP_NAME` in `process.env` |

### Env Var Flattening for Groups

Groups produce nested TypeScript types but flat environment variable names:

```
group database {
  HOST : z.string() { ... }
  PORT : z.number() = 5432
}
```

- TypeScript: `vars.database.HOST`, `vars.database.PORT`
- process.env: `DATABASE_HOST`, `DATABASE_PORT`

The generated `parseVars` function maps between these.

### Platform Targets

```bash
vars gen config.vars                            # default: process.env
vars gen config.vars --platform cloudflare      # env bindings
vars gen config.vars --platform deno            # Deno.env.get()
vars gen config.vars --platform static --env prod  # inlined values (requires key)
```

The only difference is how values are read:

```typescript
// --platform node (default)
export const vars: Vars = parseVars(process.env)

// --platform cloudflare
export function getVars(env: CloudflareEnv): Vars { return parseVars(env) }

// --platform deno
export const vars: Vars = parseVars(Deno.env.toObject())

// --platform static --env prod
export const vars: Vars = { APP_NAME: "my-app", PORT: 8080, ... }
```

The `--platform static` mode requires the encryption key at gen time because it embeds actual decrypted values. All other modes only need schema and structure.

### Freshness

The generated file includes `@vars-source-hash` — a hash of the source `.vars` file AND all transitively `use`-imported files. If any file in the dependency tree changes, the hash is stale. `vars check --fresh` detects stale codegen. The pre-commit hook can optionally verify freshness.

### Import Alias

`vars init` sets up a `#vars` import in `package.json`:

```json
{
  "imports": {
    "#vars": "./vars.generated.ts"
  }
}
```

All application code uses `import { vars } from '#vars'`.

---

## 6. CLI Commands

### Core Workflow

| Command | What it does |
|---|---|
| `vars init` | Interactive setup: create `.vars` file, set PIN, create key, update `.gitignore`, install hook, set up `#vars` import |
| `vars gen <file>` | Generate `.ts` from entry point. Resolves `use` imports. No key needed. |
| `vars gen --all` | Find all entry point `.vars` files, generate each. Discovery heuristic: a `.vars` file is an entry point if it has a sibling `package.json` with a `#vars` import alias, OR if it is explicitly listed in `vars gen --all`. Files that are only `use`-imported by other files are libraries, not entry points. |
| `vars show [file]` | Rename to `.unlocked.vars` and decrypt in-place. Does NOT modify `use` dependencies (they remain locked). Dependencies are resolved in-memory for commands like `vars run` and `vars gen`, not decrypted on disk. Requires PIN. |
| `vars hide` | Encrypt all `*.unlocked.vars` files and rename back to `*.vars`. Requires PIN. |
| `vars toggle [file]` | If locked → show. If unlocked → hide. |
| `vars run --env <env> [--param key=val] -- cmd` | Decrypt in-memory, inject into `process.env`, spawn cmd |
| `vars check [file]` | Validate schemas, run `check` blocks, report expired/deprecated, detect stale codegen |
| `vars add <name>` | Interactive: add variable to a `.vars` file |
| `vars remove <name>` | Remove a variable |

### Key Management

| Command | What it does |
|---|---|
| `vars key init` | Create new master key + set PIN |
| `vars key rotate` | New master key, re-encrypt all files |
| `vars key fingerprint` | Print key fingerprint (for verifying teammates have the right key) |
| `vars key export` | Print base64 master key (for setting `VARS_KEY` in CI) |

### Inspection

| Command | What it does |
|---|---|
| `vars ls` | List all `.vars` files with lock state, var count, warnings |
| `vars ls <file>` | List variables in file with schema, metadata, public/secret |
| `vars diff --env dev,prod [file]` | Compare values across environments |
| `vars coverage [file]` | Show which envs have values, which are missing |
| `vars doctor` | Diagnose setup: key? hook? gitignore? codegen fresh? |

### Deployment

| Command | What it does |
|---|---|
| `vars export --env <env> [--format dotenv\|json\|k8s-secret]` | Export resolved values |
| `vars push --env <env> --platform vercel\|cloudflare\|fly` | Push to platform API (future) |

---

## 7. `use` Resolution & Composition

### Resolution Rules

- Paths are relative to the importing file's directory.
- Cycle detection — A uses B uses A → parse error.
- No arbitrary depth limit. Cycles are the only guard.
- Multiple `use` statements allowed (multi-parent composition).

### `env()` Compatibility

When file A `use`s file B, their `env()` declarations must be compatible. File B's declared envs must be a subset of (or equal to) file A's declared envs. File A (the entry point) defines the canonical environment set. A library file declaring envs not present in the entry point produces a warning (those values will never be used).

### `param` Compatibility

When file A `use`s file B and both declare `param region`, the enum values must match exactly. Mismatch is a parse error.

### Conflict Resolution

- Two imports define the same variable → parse error with message: `"VAR is defined in both file-a.vars and file-b.vars — use pick/omit to resolve"`.
- Local declaration shadows any import — no error, intentional override.
- `pick` narrows import to listed names.
- `omit` excludes specific names.

### Where `use` Is Resolved

| Command | Resolves `use`? | Why |
|---|---|---|
| `vars gen` | Yes | Needs full variable set for complete types |
| `vars run` | Yes | Needs all values to inject |
| `vars check` | Yes | Needs full set for `check` blocks |
| `vars export` | Yes | Needs all resolved values |
| `vars show` | No | Decrypts only the target file on disk. Dependencies stay locked. |
| `vars hide` | No | Encrypts only files with `# @vars-state unlocked` header. |
| `vars ls <file>` | Yes | Shows complete resolved set |

### Architecture Split

- `@vars/core`: `parse(source: string) → VarsFile` (single file, `use` as unresolved AST nodes)
- `@vars/node`: `resolve(filePath: string) → ResolvedVars` (walks fs, parses each file, merges)

### Error Model for Missing Values

After resolution, if a required variable (no `.optional()` in schema, no default) has no value for the target env+param combination:

- `vars run` — fails before spawning with a clear error listing all missing variables and the target env.
- `vars check` — reports as a validation error per environment.
- `vars export` — fails with same error as `vars run`.
- `vars gen` — succeeds (types don't depend on values).

---

## 8. `check` Expression Language

### Why Not `@refine` (eval'd JavaScript)

The v1 `@refine` directive uses `new Function()` to eval JavaScript arrow functions. This is replaced by a restricted expression language because:

1. **Security:** The keyword blacklist is trivially bypassable (constructor chains, bracket notation, prototype pollution). The `check` language is secure by construction — no code execution possible.
2. **Readability:** `A => B` (implication) vs `!A || B` (JS pattern). The check syntax reads as English.
3. **Static analysis:** The parser knows every variable referenced, enabling typo detection at parse time.
4. **Cross-file scope:** Checks can reference variables from `use`-imported files.

### Operators

| Operator | Meaning |
|---|---|
| `==`, `!=` | Equality, inequality |
| `>`, `<`, `>=`, `<=` | Numeric comparison |
| `and`, `or`, `not` | Boolean logic |
| `=>` | Implication ("if left then right must be true") |

### Built-in Functions

| Function | Description |
|---|---|
| `defined(var)` | True if variable has a value for current env |
| `matches(var, "regex")` | Regex test |
| `one_of(var, ["a", "b"])` | Enum membership |
| `length(var)` | String/array length |
| `starts_with(var, "prefix")` | String prefix check |

### Special Variables

- `env` — current environment name (`"dev"`, `"prod"`, etc.)
- Param names — e.g., `region` if `param region` is declared.

### Implementation

A tiny expression parser (~100 lines, recursive descent) that produces a predicate function. No `new Function`, no `eval`. Only the operators and built-ins listed above are accepted — anything else is a parse error.

### When Checks Run

- `vars check` — runs all checks for each declared environment. **Requires the encryption key** because checks inspect actual values (e.g., `starts_with(stripe.SECRET_KEY, "sk_example_")`), including encrypted prod values. If no key is available, checks against encrypted values are skipped with a warning.
- `vars run --env prod` — runs checks for the target env before spawning. Key is always available (required for decryption).
- `vars gen` — does NOT run checks (no values, types only). No key needed.

---

## 9. `param` + `when` Conditionals

### Declaration

```
param region : enum(us, eu, ap) = us
```

- Declared at file top alongside `env()`.
- Type: `enum(...)` only (for now).
- Default value required.

### Usage

```
# Simple — one value per param match
public GDPR_MODE : z.boolean() {
  when region = eu => true
  else => false
}

# Combined with envs
DATABASE_URL : z.string().url() {
  dev = "postgres://localhost/myapp"
  when region = us { prod = "postgres://us-prod.db/myapp" }
  when region = eu { prod = "postgres://eu-prod.db/myapp" }
}
```

### Constraints

- Each `when` matches one param. No compound expressions.
- For the matrix (region × tier), use file composition via `use`.
- Params affect values, not types. `vars gen` does not accept `--param`.

### Resolution

```bash
vars run --env prod --param region=eu -- node server.js
vars export --env prod --param region=eu --format json
```

If no `--param` is passed, the default from the declaration is used.

### Propagation Through `use`

If a file declares `param region` and `use`s a file that also declares `param region`, the enum values must match. Mismatch is a parse error.

---

## 10. Intentional Omissions

These are explicitly out of scope for v2 launch. All are additive and can be built later without breaking the v2 syntax or architecture.

1. **External references (`from vault()`)** — Pulling secrets from AWS SSM, HashiCorp Vault at runtime. Adds provider SDK dependencies and auth complexity.
2. **Per-variable access control** — ACLs like `@access billing-team`. Single-key-per-repo is sufficient for target audience.
3. **`vars push`** — Pushing values to Vercel/Cloudflare/Fly APIs. Command stubbed, not blocking for launch.
4. **Watch mode (`vars gen --watch`)** — Auto-regenerate on file change. `vars gen` in `prepare` script covers it.
5. **Nested groups** — `group infra { group database { ... } }`. Flat groups only. Use file composition for hierarchy.
6. **Non-TypeScript codegen** — Go, Python, Rust type generation. TypeScript only until traction warrants it.
7. **GUI / TUI** — Interactive terminal UI. CLI commands are sufficient.

---

## Appendix A: Migration from v1

No migration needed — 0 users, pre-release. v1 code is deleted entirely. Clean break.

## Appendix B: File Layout Examples

### Single App

```
my-app/
  config.vars            # single entry point (locked/committed)
  config.unlocked.vars   # unlocked variant (gitignored, only exists when shown)
  vars.generated.ts      # generated
  package.json           # { "imports": { "#vars": "./vars.generated.ts" } }
  .gitignore             # includes *.unlocked.vars
  .vars/
    key                  # PIN-encrypted master key (gitignored)
  src/
    index.ts             # import { vars } from '#vars'
```

Note: `*.unlocked.vars` files are gitignored and only exist temporarily while editing secrets. Only one of `config.vars` / `config.unlocked.vars` exists at a time.

### Monorepo

```
monorepo/
  .vars/
    key                  # shared key (gitignored)
  .gitignore             # includes *.unlocked.vars
  shared/
    database.vars        # library — no generated file
    secrets.vars         # library — no generated file
  services/
    api/
      vars.vars          # entry point: use "../../shared/..."
      vars.generated.ts  # generated (contains all resolved vars)
      package.json       # { "imports": { "#vars": "./vars.generated.ts" } }
    worker/
      vars.vars          # entry point
      vars.generated.ts  # generated
      package.json
```

## Appendix C: Example `.vars` File

```
# @vars-state locked
env(dev, staging, prod)
param region : enum(us, eu) = us

use "../../shared/database.vars"

# ─── Public config ────────────────────────────────
public APP_NAME = "payments-api"
public PORT : z.number().min(1).max(65535) = 4000
public LOG_LEVEL : z.enum(["debug", "info", "warn", "error"]) = "info" {
  dev = "debug"
  prod = "warn"
}

public SUPPORTED_CURRENCIES : z.array(z.string().length(3)) {
  when region = us => ["USD", "CAD"]
  when region = eu => ["EUR", "GBP", "CHF"]
}

# ─── Secrets ──────────────────────────────────────
group stripe {
  SECRET_KEY : z.string() {
    dev  = "sk_example_placeholder"
    prod = enc:v2:aes256gcm-det:abc...:def...:ghi...
  } (owner = "payments-team", expires = 2026-12-31)

  WEBHOOK_SECRET : z.string() {
    dev  = "whsec_example_placeholder"
    prod = enc:v2:aes256gcm-det:jkl...:mno...:pqr...
  }

  public PUBLISHABLE_KEY : z.string() {
    dev = "pk_example_placeholder"
    when region = us { prod = "pk_live_us_key" }
    when region = eu { prod = "pk_live_eu_key" }
  }
}

# ─── Checks ───────────────────────────────────────
check "Test Stripe keys in dev" {
  env == "dev" => starts_with(stripe.SECRET_KEY, "sk_example_")
}

check "Webhook secret required in prod" {
  env == "prod" => defined(stripe.WEBHOOK_SECRET)
}
```
