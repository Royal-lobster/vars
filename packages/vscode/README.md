# vars for VS Code

**Encrypted, typed, schema-first environment variables** — right in your editor.

## Features

- **Syntax highlighting** for `.vars` files — variable names, Zod schemas, environment blocks, encrypted values, check blocks, groups, and metadata
- **Real-time diagnostics** — parse errors, expired secrets, deprecation warnings, and undeclared environment usage
- **Autocomplete** — top-level keywords (`env`, `param`, `use`, `group`, `public`, `check`), Zod schema methods, metadata keys, environment names, and check block functions
- **Hover information** — variable schema, visibility (public/secret), and metadata (description, owner, expires, tags)
- **Go to Definition** — jump to variable declarations and imported files
- **Code Actions** — quick fixes for common issues

## The `.vars` Format

```
# @vars-state unlocked
env(dev, staging, prod)
param region : enum(us, eu) = us

public APP_NAME = "my-app"
public PORT : z.number().int().min(1).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = "postgres://localhost:5432/myapp"
  staging = "postgres://staging.db:5432/myapp"
  prod    = enc:v2:aes256gcm-det:abc123:def456:ghi789
} (
  description = "Main database connection"
  owner = "backend-team"
  expires = 2026-12-31
)

LOG_LEVEL : z.enum(["debug", "info", "warn", "error"]) = "info" {
  dev = "debug"
  prod = "warn"
}

group cache {
  REDIS_HOST : z.string() {
    dev  = "localhost"
    prod = "redis.internal"
  }
  REDIS_PORT : z.number() = 6379
}

check "No debug in prod" {
  env == "prod" => LOG_LEVEL != "debug"
}

use "./shared.vars" { pick: [API_KEY] }
```

## Commands

| Command | Description |
|---------|-------------|
| `vars: Decrypt Values (Show)` | Decrypt and show values in the editor |
| `vars: Encrypt Values (Hide)` | Encrypt values before committing |
| `vars: Toggle Encryption` | Toggle between encrypted and decrypted views |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vars.trace.server` | `off` | Trace communication between VS Code and the language server (`off`, `messages`, `verbose`) |

## Requirements

No additional dependencies needed. The extension bundles the vars language server.

## Learn More

- [vars documentation](https://github.com/Royal-lobster/vars)
- [CLI reference](https://github.com/Royal-lobster/vars/tree/main/packages/cli)
