# The `.vars` File Format

A `.vars` file can be as simple as a `.env` file or as complex as a full config system. You only use the features you need.

## Level 0: Just Like `.env`

A `.vars` file can be just key-value pairs.

```vars
DATABASE_URL = "postgres://localhost:5432/myapp"
SECRET_KEY = "sk_test_abc123"
```

Every variable is a secret by default. Values are redacted in logs and wrapped in `Redacted<T>` at runtime.

## Level 1: Public Variables and Basic Types

Mark non-sensitive values as `public` so they aren't redacted. Add Zod schemas for type safety and validation.

```vars
public APP_NAME = "my-app"
public PORT : z.number().int().min(1).max(65535) = 3000
public DEBUG : z.boolean() = false
```

`PORT` must be an integer between 1 and 65535. `DEBUG` must be a boolean. Validated at build time and runtime.

## Level 2: Per-Environment Values

Instead of separate `.env.dev`, `.env.prod` files, declare your environments once with `env()` and put per-environment values inline.

```vars
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000

DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = "postgres://staging.db:5432/myapp"
  prod    = enc:v2:aes256gcm-det:abc123:def456:ghi789
}

LOG_LEVEL : z.enum(["debug", "info", "warn", "error"]) = "info" {
  dev  = "debug"
  prod = "warn"
}
```

`LOG_LEVEL` defaults to `"info"` for any environment without an explicit override (`staging` gets `"info"` here). The prod `DATABASE_URL` is encrypted, so the plaintext never appears in the file or version control.

## Level 3: Interpolation

Reference other variables inside string values. No copy-pasting the same host in three places.

```vars
env(dev, prod)

DB_HOST : z.string() {
  dev  = "localhost"
  prod = "prod.db.internal"
}
DB_PORT : z.number() = 5432
DB_NAME = "myapp"

DB_URL : z.string().url() = "postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}"
```

`DB_URL` resolves from the other variables at load time. Change `DB_HOST` and `DB_URL` follows. Circular references are caught.

Escape with `\${...}` if you need a literal `${` in the output.

## Level 4: Groups

Keep related variables together.

```vars
env(dev, prod)

group database {
  HOST : z.string() {
    dev  = "localhost"
    prod = "prod.db.internal"
  }
  public PORT : z.number() = 5432
}
```

Variables are accessible as `database.HOST` and `database.PORT` in the generated types.

## Level 5: Arrays and Rich Values

Not everything is a string.

```vars
env(dev, prod)

public CORS : z.array(z.string()) {
  dev  = ["http://localhost:3000"]
  prod = ["https://app.example.com", "https://admin.example.com"]
}

TLS_CERT : z.string() {
  prod = """
    -----BEGIN CERTIFICATE-----
    MIIBxTCCAWug
    -----END CERTIFICATE-----
  """
}
```

Triple-quoted strings (`"""..."""`) strip leading indentation (Kotlin-style) so you can indent them naturally in the file.

## Level 6: Metadata

Track who owns a variable, when it expires, and why it exists.

```vars
env(dev, prod)

API_KEY : z.string().min(32) {
  dev  = "sk_example_placeholder_32_chars_long!"
  prod = enc:v2:aes256gcm-det:abc:def:ghi
} (
  description = "Primary API key"
  owner = "backend-team"
  expires = 2026-09-01
  deprecated = "Migrating to OAuth — use OAUTH_CLIENT_SECRET instead"
  tags = [auth, critical]
  see = "https://wiki.internal/api-keys"
)
```

`expires` is validated. `vars doctor` warns when a secret is within 30 days of expiry. `deprecated` shows a warning at build time.

## Level 7: Parameters and Conditionals

Sometimes environment isn't enough. Maybe the same prod has different values per region or tenant.

```vars
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

Conditionals can return a simple value (`when ... => value`) or contain per-environment overrides (`when ... { env = value }`). `else` provides a fallback.

## Level 8: Check Blocks

Write rules about your config. They run at build time and in CI, so bad combinations don't make it to prod.

```vars
env(dev, prod)

DEBUG : z.boolean() = false
LOG_LEVEL : z.enum(["debug", "info", "warn", "error"]) = "info"

check "No debug logging in prod" {
  env == "prod" => LOG_LEVEL != "debug"
}

check "Debug flag consistency" {
  LOG_LEVEL == "debug" => DEBUG == true
}
```

Predicates support `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not`, `=>` (implication), and built-in functions like `defined()`, `matches()`, `one_of()`, `starts_with()`, `length()`.

## Level 9: File Composition

In a monorepo, you probably have shared infra config that multiple services need. Pull variables from other files with `use`.

**infra.vars** — shared by all services:
```vars
env(dev, prod)

SHARED_HOST : z.string() {
  dev  = "localhost"
  prod = "shared.internal"
}
public SHARED_PORT : z.number() = 8080
```

**api-service.vars** — imports what it needs:
```vars
env(dev, prod)

use "./infra.vars" { pick: [SHARED_HOST] }

APP_NAME = "api-service"
```

`pick` grabs only what you list. `omit` grabs everything except what you list. Circular imports are caught.

## Level 10: Everything Together

Here's what a real service config might look like using most of the features above.

```vars
env(dev, staging, prod)
param region : enum(us, eu, ap) = us

use "./infra.vars" { omit: [LEGACY_FLAG] }

# --- App identity ---

public APP_NAME = "payments-service"
public APP_VERSION : z.string() = "2.1.0"

# --- Database ---

group database {
  HOST : z.string() {
    dev = "localhost"
    when region = us { prod = "us-db.payments.internal" }
    when region = eu { prod = "eu-db.payments.internal" }
    when region = ap { prod = "ap-db.payments.internal" }
  }
  public PORT : z.number() = 5432
  NAME = "payments"
  URL : z.string().url() = "postgres://${database.HOST}:${database.PORT}/${database.NAME}"
}

# --- Secrets ---

STRIPE_SECRET_KEY : z.string().startsWith("sk_") {
  dev  = "sk_test_placeholder_for_local_dev_1234"
  prod = enc:v2:aes256gcm-det:a1b2c3:d4e5f6:encrypted_prod_key
} (
  description = "Stripe API secret key"
  owner = "payments-team"
  expires = 2026-12-01
  tags = [payments, critical]
)

# --- Feature flags ---

public GDPR_MODE : z.boolean() {
  when region = eu => true
  else => false
}

public MAX_RETRY : z.number().int().min(0).max(10) = 3 {
  dev = 0
}

# --- Invariants ---

check "Encrypted secrets in prod" {
  env == "prod" => defined(STRIPE_SECRET_KEY)
}

check "GDPR on in EU" {
  when region = eu => GDPR_MODE == true
}
```

A weekend project stays at Level 0. A multi-region production system uses everything. Same syntax either way.

## Quick Reference

| Feature | Syntax |
|---|---|
| Environments (optional) | `env(dev, staging, prod)` |
| Parameters | `param region : enum(us, eu) = us` |
| Public variable | `public VAR = "value"` |
| Secret variable | `VAR = "value"` |
| Zod schema | `VAR : z.string().min(1)` |
| Default value | `VAR = "default"` |
| Per-env values | `VAR { dev = "x"; prod = "y" }` |
| Encrypted value | `enc:v2:aes256gcm-det:salt:nonce:ciphertext` |
| Interpolation | `"prefix_${OTHER_VAR}_suffix"` |
| Groups | `group name { ... }` |
| Imports | `use "./file.vars" { pick: [A, B] }` |
| Metadata | `(description = "...", owner = "team")` |
| Conditional (simple) | `when region = eu => true` |
| Conditional (env) | `when region = eu { prod = "value" }` |
| Check block | `check "name" { predicate }` |
| Comments | `# comment` |
| Multiline strings | `"""..."""` |
| Arrays | `["a", "b", "c"]` |
