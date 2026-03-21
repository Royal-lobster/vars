# vars for VS Code

**Encrypted, typed, schema-first environment variables** — right in your editor.

## Features

- **Syntax highlighting** for `.vars` files — variable names, Zod schemas, environment tags, metadata, and encrypted values
- **Real-time diagnostics** — invalid Zod schemas, undefined `@refine` references, expired secrets, and deprecation warnings
- **Autocomplete** — `@` directives (`@dev`, `@prod`, `@default`, `@description`, `@expires`, etc.) and Zod schema methods
- **Hover information** — see variable schemas, metadata, and descriptions on hover
- **Go to Definition** — jump from `@refine` variable references to their declarations
- **Code Actions** — quick fixes for common issues

## The `.vars` Format

```
DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev     = enc:v1:aes256gcm:a1b2c3...:d4e5f6...:g7h8i9...
  @prod    = enc:v1:aes256gcm:j8fn2p...:t9u0v1...:w2x3y4...
  @description "Production database connection"
  @expires 2026-09-01

PORT  z.coerce.number().int().min(1024).max(65535)
  @default = 3000

@refine (env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true
  "DEBUG must be true when LOG_LEVEL is debug"
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vars.trace.server` | `off` | Trace communication between VS Code and the language server (`off`, `messages`, `verbose`) |

## Requirements

No additional dependencies needed. The extension bundles the vars language server.

## Learn More

- [vars documentation](https://github.com/Royal-lobster/vars)
- [CLI reference](https://github.com/Royal-lobster/vars/tree/main/packages/cli)
