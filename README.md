<div align="center">
  <img src="./apps/docs/public/logo.svg" alt="vars logo" width="128" height="128" />
  <h1>vars</h1>
  <p><strong>Encrypted, typed, schema-first environment variables.</strong></p>
  <p>One file. Zero SaaS. AI-safe by default.</p>
</div>

## The Problem

`.env` files are broken:

- **No encryption** -- plaintext secrets readable by AI agents, IDE extensions, and accidental git commits
- **No types** -- `process.env.PORT` is always `string | undefined`
- **No validation** -- misconfigured envs crash at runtime, not build time
- **No team story** -- "hey can someone DM me the .env?"
- **Environment drift** -- prod has 47 vars, dev has 38, nobody knows which are needed where

## The Solution

```
# config.vars -- committed to git, secrets encrypted inline

env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number().int().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = "postgres://staging.db:5432/myapp"
  prod    = enc:v2:aes256gcm-det:a1b2c3...:d4e5f6...:g7h8i9...
}

API_KEY : z.string().min(32) {
  dev  = "example-dev-key-placeholder-long-enough"
  prod = enc:v2:aes256gcm-det:j8fn2p...:t9u0v1...:w2x3y4...
} (
  description = "Primary API key"
  owner = "backend-team"
  expires = 2026-09-01
)
```

- **Schema + values + environments** in one file
- **Secrets encrypted inline** -- variable names and schemas are readable, secret values are not
- **Public values stay plaintext** -- `public` keyword skips encryption, generates plain types
- **PIN-protected key** -- AI agents can't decrypt without a human-entered PIN
- **Zod-native validation** -- type errors at build time, not runtime
- **Generated TypeScript types** -- full autocomplete and type safety

## Quick Start

```bash
# Initialize (creates config.vars, encryption key, .gitignore entries)
npx vars init

# Edit values
vars show config.vars    # decrypts secrets in-place
# ... edit in your IDE ...
vars hide                # re-encrypts all unlocked files

# Run your app
vars run --env dev -- npm start

# Generate TypeScript types
vars gen config.vars
```

## Type Safety

```typescript
// Import from generated file
import { vars } from '#vars'

vars.APP_NAME              // string -- public, no unwrap needed
vars.PORT                  // number -- coerced automatically
vars.DATABASE_URL          // Redacted<string> -- safe to log
vars.DATABASE_URL.unwrap() // actual value -- explicit opt-in
vars.TYPO_VAR              // TS error -- doesn't exist
```

Public variables generate plain types. Secret variables generate `Redacted<string>` -- safe to pass around, explicit `.unwrap()` to access.

## Composition

Share config across services with `use`:

```
# shared/database.vars
env(dev, prod)

DB_HOST : z.string() {
  dev  = "localhost"
  prod = "prod.db.internal"
}
DB_PORT : z.number() = 5432
```

```
# services/api/vars.vars
env(dev, prod)

use "../../shared/database.vars"

public APP_NAME = "api"
DB_URL : z.string() = "postgres://${DB_HOST}:${DB_PORT}/mydb"
```

Interpolation (`${DB_HOST}`) resolves per-environment. Change a shared value once, every service picks it up.

## Groups

Organize related variables:

```
group stripe {
  SECRET_KEY : z.string() {
    dev  = "sk_example_placeholder"
    prod = enc:v2:aes256gcm-det:...
  } (owner = "payments-team", expires = 2026-12-31)

  public PUBLISHABLE_KEY : z.string() {
    dev  = "pk_example_placeholder"
    prod = "pk_live_real"
  }
}
```

```typescript
vars.stripe.SECRET_KEY         // Redacted<string>
vars.stripe.PUBLISHABLE_KEY    // string (public)
```

Groups create nested TypeScript types and flat env var names (`STRIPE_SECRET_KEY`).

## Conditionals

Parameterize config for multi-region deployments:

```
env(dev, staging, prod)
param region : enum(us, eu) = us

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

```bash
vars run --env prod --param region=eu -- node server.js
```

One file instead of 24. No more per-region config duplication.

## Check Blocks

Cross-variable constraints with a safe, restricted expression language (no JavaScript eval):

```
check "No debug logging in prod" {
  env == "prod" => LOG_LEVEL != "debug"
}

check "SMTP config required when using SMTP provider" {
  EMAIL_PROVIDER == "smtp" => defined(SMTP_HOST) and defined(SMTP_PORT)
}

check "Test keys only in dev" {
  env == "dev" => starts_with(stripe.SECRET_KEY, "sk_example_")
}
```

Checks run during `vars check` and `vars run` -- invalid configs fail before your app starts.

## AI Safety

```
cat config.vars   -> variable names visible, secret values encrypted
cat .vars/key     -> encrypted blob (PIN-protected with Argon2)
vars show         -> prompts for human PIN
vars hide         -> prompts for human PIN
```

The only way to access secrets: a human enters the PIN. AI coding agents can't complete that step.

## Framework Support

`vars run` works with **any** framework -- no per-framework adapter needed:

```json
{
  "scripts": {
    "dev": "vars run --env dev -- next dev",
    "build": "vars run --env prod -- next build"
  }
}
```

Framework-specific prefixes (`NEXT_PUBLIC_*`, `VITE_*`) work because `vars run` sets `process.env` before the framework starts.

## Platform Targets

Generate TypeScript for any platform:

```bash
vars gen config.vars                          # Node.js (default)
vars gen config.vars --platform cloudflare    # Cloudflare Workers
vars gen config.vars --platform deno          # Deno
vars gen config.vars --platform static --env prod  # Inlined values
```

## Deploy

Set **one env var** on your platform:

```
VARS_KEY=<base64-master-key>
```

Get the key with `vars key export`. The `.vars` file is in the repo. `vars run` decrypts at build time.

## CLI Commands

| Command | Description |
|---------|-------------|
| `vars init` | Initialize vars in your project |
| `vars gen <file>` | Generate TypeScript types |
| `vars show [file]` | Decrypt a file in-place |
| `vars hide` | Encrypt all unlocked files |
| `vars toggle [file]` | Flip between locked/unlocked |
| `vars run --env <env> -- cmd` | Run with decrypted env vars |
| `vars check [file]` | Validate schemas + check blocks |
| `vars ls` | List files and variables |
| `vars diff --env dev,prod` | Compare environments |
| `vars export --env prod` | Export as dotenv/json/k8s-secret |
| `vars key init` | Create encryption key |
| `vars key rotate` | Rotate encryption key |
| `vars doctor` | Diagnose setup issues |

## Packages

| Package | Description |
|---------|-------------|
| `@vars/core` | Parser, resolver, validator, codegen, `Redacted<T>` |
| `@vars/node` | Crypto, key management, file resolution |
| `@vars/cli` | Command-line tool (`vars`) |
| `@vars/lsp` | Language Server Protocol for IDE support |
| `@vars/vscode` | VS Code / Cursor extension |

## License

MIT
