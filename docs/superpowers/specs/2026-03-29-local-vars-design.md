# `.local.vars` — Per-Developer Override Files

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Add automatic per-developer override layer via `.local.vars` files

## Problem

When a team shares `.vars` files, every developer gets the same `dev` environment values. But developers often have different local setups — one runs Postgres on `localhost:5432`, another uses Docker at `host.docker.internal:5433`. There's no way to express per-developer overrides without either:

- Polluting the shared config with `param` branches for every developer's setup
- Creating a separate gitignored `.vars` file and pointing all CLI commands at it instead of the shared one

## Solution

A `.local.vars` file is a gitignored, plaintext, per-developer override that automatically layers on top of its corresponding `.vars` file. It uses full `.vars` syntax and follows the existing shadowing semantics.

```
config.vars              ← committed, shared by team
config.local.vars        ← gitignored, per-developer overrides
```

## Naming Convention

Follows the existing `<name>.<modifier>.vars` pattern:

| File | Purpose |
|------|---------|
| `config.vars` | Locked (encrypted) shared config |
| `config.unlocked.vars` | Unlocked (plaintext) shared config |
| `config.local.vars` | Per-developer local overrides |

The local file is the same regardless of whether the base file is locked or unlocked. Both `config.vars` and `config.unlocked.vars` resolve to `config.local.vars` as their overlay.

Local files are **never encrypted** — they are always plaintext and always gitignored. There is no `config.unlocked.local.vars` or `config.local.unlocked.vars`.

## Resolution Order

```
1. Base file resolves its `use` imports              (existing)
2. Base file's own declarations shadow imports        (existing)
3. config.local.vars declarations shadow everything   (NEW)
```

Local sits on top of the fully-resolved base file. One additional layer, predictable merge order.

## Syntax and Scoping Rules

### Full `.vars` syntax

Local files support the complete `.vars` language: env blocks, groups, schemas, interpolation, `use` imports, and conditionals. No restrictions — full syntax means full syntax.

### New variables allowed

Local can introduce variables that don't exist in the base file. A developer might need `DEBUG_SQL=true` or `LOCAL_TUNNEL_PORT=8080` that only exists on their machine.

### Schema overrides

If a local file redeclares a variable with a different schema than the base, the local schema wins — same semantics as `use` shadowing. This lets developers loosen validation for local-only values (e.g., allowing `localhost` URLs that wouldn't pass a stricter production schema).

### `env()` and `param` inherited from base

The base file is authoritative for structural declarations (`env()` and `param`). If a local file declares `env()` or `param`, they are **ignored with a CLI warning**:

```
⚠ config.local.vars: env() declaration ignored (inherited from config.vars)
⚠ config.local.vars: param "region" ignored (inherited from config.vars)
```

This prevents local files from accidentally changing the environment/parameter structure that the team agreed on.

### Top-level only

Only the entry-point file (the one passed to `vars run`, `vars show`, etc.) gets a `.local.vars` overlay. Files reached via `use` imports do **not** automatically pick up their own `.local.vars` siblings.

Rationale: imported files represent shared infrastructure config. If a developer needs to override something from an import, they redeclare it in their top-level `config.local.vars`. Recursive local files would create confusing merge-order ambiguity.

## Implementation

### Affected packages

**`@vars/node` (use-resolver.ts):**
- After `resolveFile()` returns the fully-merged base result, check for a `.local.vars` sibling
- Compute local path: strip `.unlocked` modifier if present, insert `.local` before `.vars`
- If local file exists, parse it and merge its declarations on top (local shadows base, same semantics as existing `use` shadowing)
- Warn and discard any `env()` or `param` declarations from the local file
- Add the local file path to `sourceFiles` for tracing

**`@vars/node` (unlocked-path.ts or new local-path.ts):**
- `toLocalPath(basePath: string): string` — given any `.vars` path (locked or unlocked), return the `.local.vars` sibling path
- Examples:
  - `config.vars` → `config.local.vars`
  - `config.unlocked.vars` → `config.local.vars`

**`@vars/cli` (init command):**
- When running `vars init`, add `*.local.vars` to `.gitignore`

**`@vars/cli` (run/show/list commands):**
- When a `.local.vars` file is detected and merged, print a subtle note:
  ```
  Using local overrides from config.local.vars
  ```

### Not affected

- **`@vars/core`** — no changes needed. The resolver, parser, and validator are unaware of local files. Merging happens at the `@vars/node` layer before `resolveAll()` is called.
- **Encryption** — local files are never encrypted. They contain developer-specific values that don't need to be shared or protected by the team key.
- **LSP/VS Code** — no changes needed for MVP. Local files are valid `.vars` files and get syntax highlighting automatically.

## Example

**Shared `config.vars` (committed):**
```vars
env(dev, staging, prod)

DATABASE_URL : z.string().url() {
  dev     = "postgres://shared-dev.internal:5432/myapp"
  staging = "postgres://staging.db:5432/myapp"
  prod    = "postgres://prod.db/myapp"
}

REDIS_URL : z.string().url() {
  dev     = "redis://shared-dev.internal:6379"
  staging = "redis://staging.redis:6379"
  prod    = "redis://prod.redis:6379"
}
```

**Developer A's `config.local.vars` (gitignored):**
```vars
# I run Postgres locally
DATABASE_URL : z.string().url() {
  dev = "postgres://localhost:5432/myapp"
}
```

**Developer B's `config.local.vars` (gitignored):**
```vars
# I use Docker for everything
DATABASE_URL : z.string().url() {
  dev = "postgres://host.docker.internal:5433/myapp"
}

REDIS_URL : z.string().url() {
  dev = "redis://host.docker.internal:6380"
}

# Local-only debug flag
DEBUG_SQL = "true"
```

**Result for Developer A (`vars run --env dev`):**
```
DATABASE_URL = postgres://localhost:5432/myapp       ← from local
REDIS_URL    = redis://shared-dev.internal:6379      ← from base
```

**Result for Developer B (`vars run --env dev`):**
```
DATABASE_URL = postgres://host.docker.internal:5433/myapp  ← from local
REDIS_URL    = redis://host.docker.internal:6380           ← from local
DEBUG_SQL    = true                                        ← local-only
```

## Testing

- Unit tests in `@vars/node` for local path computation
- Unit tests for merge behavior: local shadows base, local adds new vars, local env()/param ignored with warning
- Integration test: `vars run` with and without `.local.vars` present
- Edge cases: base is locked vs unlocked, local file has `use` imports, local file doesn't exist (no-op)
