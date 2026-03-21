# PRD: Encrypted, Typed, Schema-First Environment Variables

> **Status:** Draft v4
> **Authors:** Srujan + Res
> **Date:** 2026-03-21

---

## 1. Problem Statement

Environment variables are broken. The `.env` file hasn't evolved in decades, yet it's the backbone of every modern application's configuration. Here's what's wrong:

### 1.1 No Encryption
- `.env` files contain plaintext secrets (API keys, database URLs, tokens)
- AI agents, IDE extensions, and telemetry can read them trivially
- Accidental git commits leak secrets — `.gitignore` is the only protection
- Sharing secrets between teammates happens over Slack DMs and emails

### 1.2 No Schema Validation
- No way to define what variables are required, what types they should be
- Misconfigured envs cause runtime crashes, not build-time errors
- `.env.example` files are always stale — nobody maintains them
- New developers have no idea what values are valid

### 1.3 No Type Safety
- `process.env.PORT` is always `string | undefined`, never `number`
- Every env access requires manual parsing and validation
- No IDE autocomplete for env var names
- Typos in env var names are silent failures

### 1.4 No Team Sharing Story
- "Hey can someone DM me the .env?" — every new developer ever
- Copy-pasting secrets over insecure channels
- No versioning of secret changes
- No audit trail of who changed what

### 1.5 Environment Drift
- Production has 47 vars, dev has 38, staging has 42
- Nobody knows which vars are needed where
- Conditional requirements ("SMTP_HOST required only if EMAIL_PROVIDER=smtp") can't be expressed

### 1.6 Monorepo Pain
- Same `DATABASE_URL` duplicated across 5 packages
- Change it in one place, forget the others
- No inheritance or sharing model

---

## 2. Solution Overview

A single-file, schema-first environment variable system that provides:

1. **AI-safe encryption** — ALL values encrypted, PIN-protected key that AI agents can't access
2. **Typed schemas** — Zod-compatible syntax, validated at load time
3. **Type generation** — generates typed accessors for TypeScript (and other languages)
4. **Multi-environment** — dev/staging/prod values colocated in one file
5. **Team sharing** — one key to share, everything else is in the repo
6. **Framework plugins** — first-class Next.js, Astro, Vite, NestJS, Turborepo support
7. **CLI** — encrypt, decrypt, validate, generate, push to platforms

### Design Principles

- **One file** — schema + values + environments, all colocated
- **Zero SaaS** — no subscriptions, no cloud dependencies, fully local
- **Zod-native** — schema syntax IS Zod, zero learning curve for TS devs
- **Progressive adoption** — migrate from `.env` in 30 seconds
- **Git-first** — encrypted file committed to repo, key gitignored
- **Encrypt everything** — all values encrypted, no heuristics or pattern matching

---

## 3. File Format Specification

### 3.1 The `.vars` File

```
# ── Database ──────────────────────────────────────
DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev     = enc:v1:aes256gcm:a1b2c3...:d4e5f6...:g7h8i9...
  @staging = enc:v1:aes256gcm:k2mx8f...:j3n4p5...:q6r7s8...
  @prod    = enc:v1:aes256gcm:j8fn2p...:t9u0v1...:w2x3y4...

DATABASE_POOL  z.coerce.number().int().min(1).max(100)
  @default = enc:v1:aes256gcm:m1n2o3...:p4q5r6...:s7t8u9...
  @prod    = enc:v1:aes256gcm:v0w1x2...:y3z4a5...:b6c7d8...

# ── Server ────────────────────────────────────────
PORT  z.coerce.number().int().min(1024).max(65535)
  @default = enc:v1:aes256gcm:e9f0g1...:h2i3j4...:k5l6m7...
  @prod    = enc:v1:aes256gcm:n8o9p0...:q1r2s3...:t4u5v6...

LOG_LEVEL  z.enum(["debug", "info", "warn", "error"])
  @dev     = enc:v1:aes256gcm:w7x8y9...:z0a1b2...:c3d4e5...
  @default = enc:v1:aes256gcm:f6g7h8...:i9j0k1...:l2m3n4...
  @prod    = enc:v1:aes256gcm:o5p6q7...:r8s9t0...:u1v2w3...

DEBUG  z.coerce.boolean()
  @dev     = enc:v1:aes256gcm:x4y5z6...:a7b8c9...:d0e1f2...
  @default = enc:v1:aes256gcm:g3h4i5...:j6k7l8...:m9n0o1...

# ── Auth ──────────────────────────────────────────
API_KEY  z.string().min(32)
  @description "Primary API key for external service"
  @expires     2026-09-01
  @owner       backend-team
  @dev     = enc:v1:aes256gcm:p2q3r4...:s5t6u7...:v8w9x0...
  @staging = enc:v1:aes256gcm:y1z2a3...:b4c5d6...:e7f8g9...
  @prod    = enc:v1:aes256gcm:h0i1j2...:k3l4m5...:n6o7p8...

JWT_SECRET  z.string().min(64)
  @expires     2026-06-01
  @dev     = enc:v1:aes256gcm:q9r0s1...:t2u3v4...:w5x6y7...
  @prod    = enc:v1:aes256gcm:z8a9b0...:c1d2e3...:f4g5h6...

LEGACY_TOKEN  z.string().min(16)
  @deprecated "Use API_KEY instead"
  @dev     = enc:v1:aes256gcm:r1s2t3...:u4v5w6...:x7y8z9...
  @prod    = enc:v1:aes256gcm:a0b1c2...:d3e4f5...:g6h7i8...

# ── Optional ──────────────────────────────────────
ANALYTICS_ID  z.string().optional()
  @prod    = enc:v1:aes256gcm:i7j8k9...:l0m1n2...:o3p4q5...
```

> **Note:** All values are encrypted in the committed file. Only the variable names and Zod schemas are readable. Use `vars show` to decrypt in-place for editing, then `vars hide` to re-encrypt.

### 3.2 Format Rules

1. **Variable declaration:** `NAME  z.<schema>()`
   - Name must be UPPER_SNAKE_CASE
   - Schema is valid Zod chain syntax
   - Separated by 2+ spaces

2. **Environment values:** `@env = value` (indented under variable)
   - `@default` — fallback when no env-specific value exists
   - `@dev`, `@staging`, `@prod`, `@test`, or any custom name
   - If no `@default` and variable is not `.optional()`, it's required in all envs

3. **Encrypted values:** `enc:v1:aes256gcm:<base64(iv)>:<base64(ciphertext)>:<base64(tag)>`
   - All values are encrypted — no plaintext in committed files
   - The `v1` prefix enables future algorithm changes without breaking existing files
   - Each value gets its own IV/nonce

4. **Comments:** Lines starting with `#`
   - Section headers: `# ── Section Name ──`

5. **Inheritance:** `@extends <path>`
   - Pulls in variables from parent `.vars` file
   - Local definitions override parent
   - Used in monorepos
   - Circular extends → parse error
   - Max depth: 3 levels (root → group → app)
   - Local paths only (no URLs or remote extends)
   - If parent adds a required variable, child fails on `vars check` until addressed

6. **Value resolution order** (highest → lowest priority):
   1. Child's `@<env>` value
   2. Child's `@default` value
   3. Parent's `@<env>` value (via `@extends`)
   4. Parent's `@default` value
   5. Zod `.default()` in schema
   6. `undefined` → validation error if required

7. **Metadata directives:** `@directive value` (no `=`, indented under variable)
   - `@description "text"` — human-readable description of the variable
   - `@expires YYYY-MM-DD` — rotation reminder; `vars check` warns when approaching, errors when past
   - `@deprecated "message"` — warns on usage; message suggests replacement
   - `@owner team-name` — who owns this variable
   - Directives vs env values: directives have **no `=`**, env values always have `=`
   - Metadata is informational — it does not affect runtime behavior or type generation

8. **String quoting rules** (applies during `vars edit` when values are decrypted):
   - Quotes optional for simple values (no spaces, no special characters)
   - Required for: values with spaces, `#`, leading/trailing whitespace, empty strings
   - Single or double quotes accepted
   - Unquoted `#` starts a comment
   - Empty value: `@dev = ""`
   - Parser splits on first `=` only, so `=` in values is fine unquoted
   - Multiline values: not supported in v0.1 (use JSON-encoded strings)

### 3.3 File Hierarchy

```
.vars              # project root (or monorepo root for shared vars)
.vars.key          # decryption key (gitignored)
apps/web/.vars     # app-specific vars (@extends ../../.vars)
apps/api/.vars     # app-specific vars (@extends ../../.vars)
```

---

## 4. Encryption Model

### 4.1 Key Management — PIN-Protected

The master key is stored on disk **encrypted with a human-memorized PIN**:

```
# .vars.key (what's on disk — useless without PIN)
pin:v1:aes256gcm:<salt>:<iv>:<encrypted_master_key>:<tag>
```

**Why PIN?** AI agents with shell access can read files and run CLIs. A PIN that only lives in the human's head is the one thing they can't access. This makes vars **AI-safe by default**.

**Workflow:**
1. `vars init` → generates master key + asks human to set a PIN
2. Master key encrypted with PIN (via Argon2id key derivation + AES-256-GCM)
3. `.vars.key` contains encrypted master key (safe even if agent reads it)
4. `vars unlock` → prompts for PIN, stores decrypted key in OS keychain
5. `vars lock` → clears key from OS keychain
6. All commands that need decryption check keychain first, prompt for PIN if not found

**OS Keychain Integration:**
- macOS: Keychain Access (requires system password/biometrics)
- Linux: libsecret / GNOME Keyring / KDE Wallet
- Windows: Windows Credential Manager
- Fallback: in-memory env var `VARS_KEY` (for CI/CD)

**Optional per-environment keys:** `.vars.key.prod`, `.vars.key.staging` (each PIN-protected separately)
**Key derivation:** HKDF-SHA256 from master key + environment name (if per-env keys)

### 4.2 Encryption Algorithm

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Per-value encryption:** Each value gets its own IV/nonce
- **Format:** `enc:v1:aes256gcm:<base64(iv)>:<base64(ciphertext)>:<base64(tag)>`
- **Version prefix:** `v1` enables future algorithm migration without breaking existing files

### 4.3 Encryption Strategy

**All values are encrypted.** No heuristics, no pattern matching, no "secret detection." The only readable parts of a committed `.vars` file are variable names, Zod schemas, and comments. This eliminates the entire class of "missed secret" bugs.

### 4.4 State Detection

The CLI determines whether `.vars` is encrypted or decrypted by checking if values start with the `enc:v1:` prefix. No header or state file needed.

### 4.5 Three Decryption Modes

There are three ways secrets get decrypted. Developers should use the right one:

**A. Framework plugin (`withEnvx()`)** — primary flow for supported frameworks
```bash
npm run dev                # just works — plugin decrypts in memory
```
- Plugin reads `.vars` (encrypted on disk), decrypts in memory, injects into `process.env`
- File stays encrypted on disk. Nothing changes.
- Used for: Next.js, Vite, Astro, NestJS — any framework with a vars plugin

**B. `vars run`** — for non-framework tools or other languages
```bash
vars run --env dev -- python app.py
vars run --env dev -- docker compose up
```
- Decrypts in memory, injects into child process's `process.env`, spawns command
- When process exits, secrets are gone from memory
- File stays encrypted on disk
- Used for: Python, Go, Rust, Docker, or any tool without a vars plugin

**C. `vars show` / `vars hide`** — for editing values only
```bash
vars show          # decrypts in-place — file now has plaintext
# edit .vars in IDE
vars hide          # re-encrypts in-place
```
- Decrypts on disk so you can edit in your IDE
- **NOT for running apps** — use mode A or B instead
- `vars toggle` — shortcut that flips between show/hide states
- Git pre-commit hook runs `vars hide` as a safety net — re-encrypts and blocks commit if any plaintext values remain

### 4.5 Key Sharing

- New teammate joins → existing member sends them `.vars.key` + tells them the PIN
- The `.vars.key` file alone is useless (encrypted with PIN)
- Even if `.vars.key` leaks to git, secrets are still protected by PIN
- On Vercel/Netlify/Railway → set `VARS_KEY=<decrypted_master_key>` as env var (bypasses PIN for CI/CD)
- Key rotation: `vars rotate` generates new master key + new PIN, re-encrypts all values

---

## 5. CLI Commands

### 5.1 Core Commands

| Command | Description |
|---------|-------------|
| `vars init` | Scan existing `.env`, prompt for types, generate `.vars` + `.vars.key` |
| `vars add <NAME>` | Interactive: add variable with type, values per env, auto-encrypt |
| `vars remove <NAME>` | Remove a variable from `.vars` |
| `vars check [--env <env>]` | Validate all values against schemas (see error format below) |
| `vars gen [--lang ts\|py\|go\|rust]` | Generate typed accessors |

**Validation error format:**
```
✗ vars check failed (3 errors, 2 warnings)

  DATABASE_URL (@prod):
    Expected: z.string().url()
    Got: "not-a-url"
    → Must be a valid URL starting with a protocol

  PORT (@dev):
    Missing required value
    → Add @dev value or set @default

  API_KEY (@staging):
    Expected: z.string().min(32)
    Got: string of length 12
    → Minimum 32 characters required

  ⚠ JWT_SECRET:
    Expires in 12 days (2026-06-01)
    → Rotate this secret before expiry

  ⚠ LEGACY_TOKEN:
    Deprecated: "Use API_KEY instead"
    → Migrate usages and remove this variable
```
Every error includes: variable name, environment, expected schema, actual value (redacted if sensitive), and a human-readable fix suggestion. Expiry and deprecation warnings are surfaced alongside validation errors.

### 5.2 Encryption Commands

| Command | Description |
|---------|-------------|
| `vars unlock` | Enter PIN → cache decrypted key in OS keychain |
| `vars lock` | Clear decrypted key from OS keychain |
| `vars show` | Decrypt all values in-place within `.vars` for editing (requires unlock) |
| `vars hide` | Re-encrypt all values in-place within `.vars` |
| `vars toggle` | Flip between show/hide states |
| `vars rotate` | Generate new key + PIN, re-encrypt all values |

### 5.3 Platform Commands

| Command | Description |
|---------|-------------|
| `vars push --vercel [--env <env>]` | Push decrypted vars to Vercel |
| `vars push --netlify [--env <env>]` | Push decrypted vars to Netlify |
| `vars push --railway [--env <env>]` | Push decrypted vars to Railway |
| `vars push --fly [--env <env>]` | Push decrypted vars to Fly.io |
| `vars pull --vercel` | Pull current vars from Vercel, update `.vars` |

### 5.4 Utility Commands

| Command | Description |
|---------|-------------|
| `vars run --env <env> -- <cmd>` | Decrypt in memory, inject into process.env, run command (file stays encrypted) |
| `vars status` | Show current state: encrypted/decrypted, keychain unlocked, active env, variable count |
| `vars diff [--env <env>]` | Show differences between environments |
| `vars doctor` | Check for common issues (missing key, stale vars, expiring secrets, etc.) |
| `vars hook install` | Install git pre-commit hook for auto-encryption |
| `vars ls` | List all variables with environments, required/optional status, and metadata |
| `vars template [--env <env>]` | Generate a `.env` file from `.vars` (for Docker, legacy tools) |
| `vars completions <shell>` | Generate shell completions for bash/zsh/fish |

### 5.5 Analysis Commands

| Command | Description |
|---------|-------------|
| `vars typecheck` | Scan codebase for `process.env.*` references not defined in `.vars` |
| `vars coverage [--env <env>]` | Show % of variables with values set per environment |
| `vars blame <NAME>` | Show git history of who last changed a variable |
| `vars history <NAME>` | Show full change history of a variable across environments |

---

## 6. Runtime Packages

### 6.1 Core Package: `@vars/core`

The foundation — parser, validator, crypto. No framework dependencies.

```typescript
import { loadEnvx, parseSchema, decrypt, validate, Redacted } from '@vars/core'

const config = loadEnvx('.vars', {
  env: 'production',
  key: process.env.VARS_KEY,
})
// Returns: validated, decrypted config object
// String values are wrapped in Redacted<string>

console.log(config.API_KEY)            // → "<redacted>"
console.log(JSON.stringify(config))    // → all string values show "<redacted>"
console.log(config.API_KEY.unwrap())   // → actual value (explicit opt-in)
console.log(config.PORT)               // → 3000 (numbers/booleans are not redacted)
```

**Early fail behavior:** `loadEnvx()` throws immediately if validation fails — no partial results, no fallbacks. The error includes all validation failures at once (not just the first), formatted for readability:

```
✗ vars: environment validation failed (2 errors)

  DATABASE_URL (@production):
    Missing required value
    → Add @prod value or set @default

  API_SECRET (@production):
    Expected: z.string().min(16)
    Got: string of length 8
    → Minimum 16 characters required
```

This runs before the app or framework starts — a Next.js build will fail at config loading, not midway through compilation. Same behavior as t3-env: if your env is wrong, nothing runs.

**`Redacted<T>` type** (exported from `@vars/core`):
- `.toString()` → `"<redacted>"`
- `.toJSON()` → `"<redacted>"`
- `.unwrap()` → raw value (the only way to access it)
- `console.log()`, template literals, string concatenation — all safe, all redacted
- Non-string types (numbers, booleans) are returned as plain values since they're not secrets

### 6.2 Generated Types

`vars gen` reads `.vars` and generates:

```typescript
// env.generated.ts (auto-generated, do not edit)
import { z } from 'zod'
import { loadEnvx, Redacted } from '@vars/core'

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres://"),
  DATABASE_POOL: z.coerce.number().int().min(1).max(100).default(10),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DEBUG: z.coerce.boolean().default(false),
  API_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(64),
  ANALYTICS_ID: z.string().optional(),
})

// Redacted type — string values wrapped, numbers/booleans plain
export type Env = {
  DATABASE_URL: Redacted<string>
  DATABASE_POOL: number
  PORT: number
  LOG_LEVEL: "debug" | "info" | "warn" | "error"
  DEBUG: boolean
  API_KEY: Redacted<string>
  JWT_SECRET: Redacted<string>
  ANALYTICS_ID?: Redacted<string>
}

// Server env (all variables)
export const env: Env = loadEnvx('.vars', {
  env: process.env.VARS_ENV || 'development',
  schema,
})

// Client env (only PUBLIC_* variables)
export const clientEnv: Pick<Env, 'ANALYTICS_ID'> = {
  ANALYTICS_ID: env.ANALYTICS_ID,
}
```

---

## 7. Plugin System & Framework Integrations

### 7.1 Plugin Architecture

Each framework integration is a separate package that imports `@vars/core` directly. No shared plugin interface — each package is just a thin wrapper that knows how to hook into its framework.

```
@vars/core       → parser, crypto, validator
@vars/cli        → CLI tool (uses core)
@vars/next       → Next.js wrapper
@vars/astro      → Astro wrapper
@vars/vite       → Vite wrapper (covers SvelteKit, Nuxt, Remix)
@vars/nestjs     → NestJS wrapper
@vars/turbo      → Turborepo utilities
```

All framework packages share the same options pattern:

```typescript
interface VarsOptions {
  envFile?: string        // default: '.vars'
  env?: string            // default: process.env.VARS_ENV || 'development'
  key?: string            // default: process.env.VARS_KEY || read from .vars.key
}
```

### 7.2 Next.js Integration

```typescript
// next.config.ts
import { withEnvx } from '@vars/next'

export default withEnvx({
  // optional overrides
  env: 'production',
})

// Internally:
// 1. Reads .vars
// 2. Regenerates env.generated.ts if .vars changed (types never go stale)
// 3. Decrypts with VARS_KEY
// 4. Validates with Zod
// 5. Injects into process.env before Next.js reads it
// 6. Splits NEXT_PUBLIC_* for client bundle
```

**Usage:**
```typescript
import { env } from '@/env.generated'       // server components
import { clientEnv } from '@/env.generated'  // client components
```

### 7.4 Astro Integration

```typescript
// astro.config.mts
import { varsIntegration } from '@vars/astro'

export default defineConfig({
  integrations: [varsIntegration()],
})
```

Hooks into `astro:config:setup`. Splits `PUBLIC_*` vars for client.

### 7.5 Vite Integration

```typescript
// vite.config.ts
import { varsPlugin } from '@vars/vite'

export default defineConfig({
  plugins: [varsPlugin()],
})
```

Replaces `import.meta.env.VITE_*` at build time. Also works for SvelteKit, Nuxt (via Vite plugin layer), and Remix.

### 7.6 NestJS Integration

```typescript
// app.module.ts
import { EnvxModule } from '@vars/nestjs'

@Module({
  imports: [
    EnvxModule.forRoot({
      envFile: '.vars',
      env: 'production',
    }),
  ],
})
export class AppModule {}

// Inject in services:
@Injectable()
export class AppService {
  constructor(@Inject(VARS) private env: Env) {}
  
  getDbUrl() {
    return this.env.DATABASE_URL  // typed!
  }
}
```

### 7.7 Turborepo Support

```
# Root .vars — shared across all apps
DATABASE_URL  z.string().url()
  @dev  = enc:v1:aes256gcm:a1b2...:c3d4...:e5f6...
  @prod = enc:v1:aes256gcm:g7h8...:i9j0...:k1l2...

REDIS_URL  z.string().url()
  @dev  = enc:v1:aes256gcm:m3n4...:o5p6...:q7r8...
  @prod = enc:v1:aes256gcm:s9t0...:u1v2...:w3x4...
```

```
# apps/web/.vars
@extends ../../.vars

NEXT_PUBLIC_API_URL  z.string().url()
  @dev  = enc:v1:aes256gcm:y5z6...:a7b8...:c9d0...
  @prod = enc:v1:aes256gcm:e1f2...:g3h4...:i5j6...
```

CLI commands for monorepos:
```bash
vars check --all                    # validate all apps
vars show --app web --env prod      # show web's prod values (inherited + own)
vars gen --all                      # generate types for all apps
vars diff --app web --app api       # compare vars between apps
```

### 7.8 Custom Framework Wrappers

Third parties can create their own framework wrappers by importing `@vars/core` directly:

```typescript
import { loadEnvx } from '@vars/core'

export function withVars(frameworkConfig) {
  const vars = loadEnvx('.vars', {
    env: process.env.VARS_ENV || 'development',
  })
  // inject vars into your framework's config
  return frameworkConfig
}
```

---

## 8. Environment Selection (`VARS_ENV`)

- `VARS_ENV` environment variable selects the active environment
- Defaults to `development` if unset
- Standard values: `development`, `staging`, `production`, `test`
- Custom values allowed (matches `@<name>` in `.vars` file)
- On deployment platforms: set `VARS_ENV=production` alongside `VARS_KEY`

### 8.1 Environment Inheritance (v1+)

Environments can inherit from other environments for preview/PR deploys:

```
@env preview : staging
```

This means `@preview` inherits all values from `@staging` but can override specific ones. Useful for:
- Vercel preview deploys
- PR-specific environments
- QA environments that are "staging but with one override"

---

## 9. Platform Deployment

### 9.1 How It Works on Platforms

On any deployment platform (Vercel, Netlify, Railway, Fly.io, AWS):

1. Set **one env var** on the platform: `VARS_KEY=<your-key>`
2. `.vars` file is in the repo (encrypted values, safe to commit)
3. At build time, the framework plugin decrypts using `VARS_KEY`
4. Application runs with decrypted, validated env vars

### 9.2 Platform Push (Optional)

For platforms where you want native env var management:

```bash
vars push --vercel --env production
```

This decrypts locally and pushes plaintext to Vercel's API. Useful for:
- Edge functions (no filesystem at runtime)
- Platform-level env var UI visibility
- Teams that want both approaches

### 9.3 Docker Integration

```bash
# Generate a .env file for docker-compose
vars template --env dev > .env.docker

# Or inject directly
vars run --env dev -- docker compose up
```

### 9.4 Platform Pull

```bash
vars pull --vercel
```

Pulls current vars from the platform, encrypts them, updates `.vars`. Useful for initial migration.

---

## 10. Git Integration

### 10.1 Pre-commit Hook

```bash
vars hook install
# Adds to .git/hooks/pre-commit or .husky/pre-commit
```

The hook runs `vars hide` before every commit:
- Scans `.vars` for any plaintext (non-encrypted) values
- Re-encrypts them in-place
- Stages the changes
- If encryption fails (no key), **blocks the commit**

### 10.2 .gitignore

```gitignore
# Added by vars init
.vars.key
.vars.key.*
.env
.env.*

# Editor swap/backup files (may contain decrypted values during vars show)
.vars.swp
.vars.swo
.vars~
.vars.bak
#.vars#
```

The `.vars` file itself is **committed** — that's the whole point.

---

## 11. Multi-Language Support

### 11.1 Phase 1: Universal CLI (Day 1)

Any language can use vars via the CLI:

```bash
vars run --env prod -- python app.py
vars run --env prod -- go run main.go
vars run --env prod -- cargo run
```

`vars run` decrypts → validates → injects into environment → spawns command.

### 11.2 Phase 2: Type Generation (Future)

```bash
vars gen --lang python   # → env.pyi (type stubs)
vars gen --lang go       # → env.go (typed struct)
vars gen --lang rust     # → env.rs (typed struct + derive macros)
```

### 11.3 Phase 3: Native SDKs (Future, If Demand)

Native runtime libraries for Python, Go, Rust that parse `.vars` directly.

---

## 12. Security Model

### 12.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| `.env` committed to git | All values encrypted, pre-commit hook ensures no plaintext |
| **AI agent reads env vars** | **PIN-protected key — agent can't decrypt without human PIN** |
| **AI agent runs `vars show`** | **Requires unlocked keychain — human must `vars unlock` first** |
| `.vars.key` leaked to git | Key is PIN-encrypted — useless without human-memorized PIN |
| Key + PIN both compromised | Per-environment keys limit blast radius; `vars rotate` |
| Man-in-the-middle key sharing | `.vars.key` alone is useless; PIN shared verbally/separately |
| Platform breach (Vercel, etc.) | Only `VARS_KEY` exposed, not individual secrets |
| Developer machine compromised | OS keychain protected by system password/biometrics |
| Brute force PIN attack | Argon2id key derivation (memory-hard, slow by design) |

### 12.2 AI Safety — The Key Differentiator

Traditional env tools (dotenv, dotenvx, t3-env) offer no protection against AI agents with shell access. If an agent can `cat .env` or run `dotenvx decrypt`, your secrets are exposed.

**vars is AI-safe by default:**

1. **File on disk is encrypted** → `cat .vars` shows ciphertext
2. **Key on disk is PIN-encrypted** → `cat .vars.key` shows encrypted blob
3. **CLI requires unlocked keychain** → `vars show` fails without `vars unlock`
4. **`vars unlock` requires PIN** → only the human knows it
5. **OS keychain is protected** → requires system password/biometrics to access
6. **CLI never logs decrypted values** → no command ever prints plaintext secrets to stdout/stderr

**The only way to access secrets:** Human enters PIN → keychain unlocks → CLI works. AI agents cannot complete step 1.

### 12.2.1 Redacted Output — No Plaintext in Terminal

AI agents can read terminal output just as easily as files. The CLI **never** prints decrypted values to stdout or stderr:

- `vars show` decrypts values in the `.vars` file in-place — it does **not** print them to the terminal
- `vars check` redacts actual values in error messages (e.g., `Got: string of length 12`, not the actual string)
- `vars run` injects env vars into the child process silently — no logging of values
- `vars diff` shows structural differences (which vars differ per env) but redacts the actual values
- `vars ls` shows variable names, schemas, environments, and metadata — never values
- Debug/verbose modes (`--debug`, `--verbose`) log operations and timing, never values
**This applies to both the CLI and the SDK.** No vars command ever prints decrypted values to the terminal.

### 12.2.2 `Redacted<T>` — DX Safety Net (Not AI Protection)

`@vars/core` exports a `Redacted<T>` type (inspired by Effect-TS) that wraps all string values returned by `loadEnvx()`. This is a **developer experience** feature, not an AI security boundary.

**What it prevents:**
- `console.log(config)` dumping all secrets
- Error reporters (Sentry, etc.) capturing env vars in stack traces
- Structured logging accidentally serializing the whole config object
- Template literals and string concatenation silently including secrets

**What it does NOT prevent:**
- An AI agent (or any code) calling `.unwrap()` to get the raw value — this is just a function call

`.toString()` and `.toJSON()` return `"<redacted>"`. Raw value access requires an explicit `.unwrap()` call. The real AI protections are layers 1–5 above (encryption, PIN, keychain). `Redacted<T>` is layer 6 — it keeps secrets out of logs, not out of determined code.

### 12.3 CI/CD & Deployment Platforms

On platforms where there's no human to enter a PIN:
- Set `VARS_KEY` env var with the decrypted master key directly
- The runtime reads `VARS_KEY` from environment, bypasses PIN/keychain
- Only one env var needed on the platform, everything else is in the encrypted `.vars` file

### 12.4 Security Boundary — At Rest vs At Runtime

**vars protects secrets at rest, not at runtime.** This is a deliberate scope boundary.

**At rest (protected):**
- File on disk → encrypted
- Key on disk → PIN-encrypted
- CLI output → redacted
- SDK types → `Redacted<T>`, accidental logging impossible
- Git history → pre-commit hook ensures encryption

**At runtime (out of scope):**
- **`process.env` is readable** — once framework plugins inject vars into `process.env` (required for Next.js, Vite, Astro, etc.), any code in that process can read them. An agent running `node -e "console.log(process.env)"` bypasses all protections. This is unavoidable — frameworks read from `process.env`, and we can't change that.
- **`/proc/<pid>/environ`** (Linux) — environment variables of running processes are readable from the filesystem
- **Node.js `--inspect` / debugger** — attaching to a running process exposes all in-memory values
- **OS clipboard** — if a developer copied a value, agents can read it (`pbpaste` on macOS)
- **Shell history** — past `export VAR=value` commands live in `~/.zsh_history` / `~/.bash_history`
- **Unlocked session** — if human runs `vars unlock` and then gives an agent shell access, the agent can use the unlocked session

**Why this is still a massive improvement:** The most common secret leaks are accidental git commits, plaintext `.env` files on disk, and AI agents reading files or CLI output. vars blocks all of these. Runtime memory access requires a level of access where the attacker can already do far worse.

This is `.env` done right with AI protection at rest — not a vault replacement, not runtime sandboxing.

---

## 13. Migration Path

### 13.1 From `.env`

```bash
vars init
# Scans .env
# Prompts: "DATABASE_URL looks like a URL. Schema: z.string().url()? [Y/n]"
# Infers types for each variable
# Generates .vars.key
# Encrypts ALL values → generates .vars (fully encrypted)
# Suggests adding .vars.key to .gitignore
```

### 13.2 From dotvars

```bash
vars migrate --from dotvars
# Reads .env.vault or encrypted .env
# Converts to .vars format
# Preserves encryption (re-encrypts with vars key)
```

### 13.3 From t3-env

```bash
vars migrate --from t3-env
# Reads env.ts Zod schema
# Converts to .vars format
# Preserves all Zod validations
```

---

## 14. Tech Stack

### 14.1 Stack

- **Language:** TypeScript (strict mode)
- **Monorepo:** Turborepo + pnpm workspaces
- **CLI framework:** citty (UnJS — subcommands, auto-generated help, lazy loading)
- **Validation:** Zod
- **Crypto:** Node.js native `crypto` (AES-256-GCM, Argon2id)
- **Keychain:** platform-specific bindings (macOS Keychain, libsecret, Windows Credential Manager)
- **Build:** tsup (fast, zero-config TS bundler)
- **Testing:** vitest
- **`Redacted<T>`:** custom lightweight implementation (~20 lines)

### 14.2 Package Structure (Monorepo)

```
packages/
  core/           → @vars/core (parser, crypto, validator)
  cli/            → @vars/cli (command-line tool)
  lsp/            → @vars/lsp (Language Server Protocol)
  vscode/         → @vars/vscode (VS Code extension — thin wrapper around LSP)
  next/           → @vars/next
  astro/          → @vars/astro
  vite/           → @vars/vite
  nestjs/         → @vars/nestjs
  turbo/          → @vars/turbo
```

### 14.3 Dependency Graph

```
@vars/cli ──→ @vars/core ←── @vars/next (+ next)
                  ↑           @vars/astro (+ astro)
                 zod          @vars/vite (+ vite)
                              @vars/nestjs (+ @nestjs/*)
                              @vars/turbo

@vars/lsp ──→ @vars/core
                  ↑
@vars/vscode ──→ @vars/lsp (thin wrapper — launch LSP, register file associations)
```

`@vars/core` depends on `zod`. Framework packages depend on `@vars/core` + their framework as a peer dep. No shared plugin interface — each package directly imports what it needs from core.

### 14.4 Language Server (`@vars/lsp`)

A Language Server Protocol implementation for `.vars` files. Build the LSP once, editor extensions are thin wrappers.

**Features:**
- **Syntax highlighting** — variable names, Zod schemas, `@env` values, `@directives`, comments, encrypted vs decrypted values (different colors)
- **Diagnostics** — inline validation errors, expired secret warnings, deprecation warnings, missing required values per env
- **Autocomplete** — env names (`@dev`, `@staging`, `@prod`, `@default`), Zod schema methods (`z.string()`, `z.coerce.number()`, etc.), variable names inherited from `@extends` parents
- **Hover** — show resolved schema type, metadata (`@description`, `@owner`, `@expires`), inheritance source (local vs parent)
- **Go to definition** — click `@extends ../../.vars` to jump to parent file
- **Code actions** — "Add missing environments" (if a variable has `@dev` but not `@prod`), "Mark as deprecated"

**Editor extensions** are thin wrappers that launch the LSP and register `.vars` file associations:
- `@vars/vscode` — VS Code / Cursor
- Neovim — LSP config (no package needed, just point to `@vars/lsp`)
- JetBrains — future, if demand

---

## 15. Error Handling

| Scenario | Behavior |
|----------|----------|
| Wrong PIN | "Invalid PIN. Try again." — 3 attempts, then exits. No lockout (Argon2id slowness is the rate limit). |
| `.vars.key` missing | "No key file found. Run `vars init` to create one, or get `.vars.key` from a teammate." |
| `.vars` file corrupted / partial parse | Parse as much as possible, report all syntax errors with line numbers, exit non-zero. |
| Validation fails (`loadEnvx`) | Throw with all errors at once (not just the first). Formatted error message. Process exits before app/framework starts. |
| Version mismatch (e.g., `enc:v2` with v1 CLI) | "Unsupported encryption version: v2. Update vars CLI: `npm i -g @vars/cli@latest`" |
| Concurrent `vars show` by two developers | Last `vars hide` wins. Values are re-encrypted from whatever's in the file. Git diff shows the conflict if both committed. |
| Unknown `@directive` | Warning, not error. Forward-compatible — older CLI ignores directives it doesn't know. |
| `@extends` target missing | Parse error with path shown: "Cannot resolve @extends: ../../.vars (file not found)" |

---

## 16. Resolved Decisions

1. **Name** — `vars`. CLI name, file extension (`.vars`), and npm scope (`@vars/*`) all aligned. npm email pending to request the name.
2. **Encryption strategy** — Encrypt everything. No heuristics, no secret detection. All values encrypted in committed files.
3. **Encryption format** — `enc:v1:aes256gcm:<iv>:<ciphertext>:<tag>` with version prefix for future algorithm migration.
4. **Resolution order** — Child `@env` → Child `@default` → Parent `@env` → Parent `@default` → Zod `.default()` → error.
5. **`VARS_ENV`** — Formal convention for environment selection. Defaults to `development`.
6. **Conditional requirements** — Out of scope for v0.1. Future approach: Zod `.refine()` with access to other variables.
7. **Parser edge cases** — Empty = empty string, no multiline v0.1, `#` in values requires quotes, `=` in values fine unquoted.
8. **Variable metadata** — Supported via `@directive value` syntax (no `=`). Directives: `@description`, `@expires`, `@deprecated`, `@owner`. Visually same prefix as env values — differentiated by the `=` sign. No separate sigil needed.
9. **Metadata vs env disambiguation** — `@dev = value` (has `=`) is an env value. `@expires 2026-06-01` (no `=`) is metadata. Parser has zero ambiguity. VS Code extension can color them differently if needed.
10. **Schema language** — Zod-native syntax, targeting TypeScript only for v0.1+. Zod → JSON Schema provides a universal intermediate representation for future multi-language support, but no multi-language abstractions until there's real traction.
11. **Validation behavior** — Early fail. `loadEnvx()` throws with all errors before the app or framework starts. Same philosophy as t3-env: if your env is wrong, nothing runs.
12. **`@extends` rules** — Local paths only, max 3 levels deep, circular extends is a parse error. Parent adding a required var causes child to fail on `vars check`.
13. **State detection** — CLI checks if values start with `enc:v1:` prefix to determine encrypted/decrypted state. No header or state file needed.
14. **Auto type generation** — Framework plugins regenerate `env.generated.ts` at build time if `.vars` changed. Types never go stale.
15. **Tech stack** — Plain TypeScript + Turborepo + pnpm workspaces. citty for CLI, Zod for validation, Node.js native crypto. No framework overhead — each package is a thin, focused module.
16. **No plugin interface** — Framework packages (`@vars/next`, `@vars/vite`, etc.) directly import `@vars/core`. No shared plugin base class or DI system. Each package is just a wrapper function.

## 16. Open Questions

1. **Zod as peer dep or bundled?** — If user already has Zod, peer dep saves bundle size. If not, bundled is simpler.
2. **CI/CD** — Should we provide GitHub Actions / GitLab CI templates?
3. **Watch mode** — `vars watch` that re-generates types when `.vars` changes?
4. **GUI** — VS Code extension for editing encrypted values inline?
5. **Secret sync** — Two-way sync with external secret managers (AWS SSM, GCP Secret Manager, 1Password)?
6. **Terraform/Pulumi provider** — Read `.vars` as a data source in IaC?

---

## 17. Success Metrics

- Migration from `.env` takes < 60 seconds
- Zero runtime overhead vs reading `process.env` directly (< 5ms startup cost)
- Framework plugin setup is ≤ 3 lines of code
- New developer onboarding: clone → receive key → works
- Git diff of `.vars` is meaningful (you can see what changed, even if encrypted)

---

## 18. Scope

Ship everything. No phased rollout — all packages built together:

- **Core:** parser, crypto, validator, `Redacted<T>`, codegen
- **CLI:** all commands (`init`, `show`, `hide`, `toggle`, `unlock`, `lock`, `run`, `check`, `gen`, `add`, `remove`, `ls`, `status`, `rotate`, `diff`, `push`, `pull`, `doctor`, `hook`, `template`, `typecheck`, `coverage`, `blame`, `completions`)
- **Framework packages:** `@vars/next`, `@vars/vite`, `@vars/astro`, `@vars/nestjs`, `@vars/turbo`
- **Editor:** `@vars/lsp`, `@vars/vscode`
- **Migrations:** from `.env`, dotenvx, t3-env
- **Platform push/pull:** Vercel, Netlify, Railway, Fly.io
