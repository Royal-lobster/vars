# Tech Stack & Project Structure

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | Target audience is TS devs, Zod-native schemas |
| Runtime | Node.js 20+ | Native `crypto` for AES-256-GCM, Argon2id via `argon2` |
| Monorepo | Turborepo + pnpm workspaces | Fast caching, parallel builds, minimal config |
| CLI | citty (UnJS) | Subcommands, auto-help, lazy loading, TypeScript-first |
| Validation | Zod | Already the schema language for `.vars` files |
| Crypto | Node.js `crypto` + `argon2` | AES-256-GCM (native), Argon2id for PIN key derivation |
| Keychain | `keytar` | Cross-platform keychain (macOS Keychain, libsecret, Windows Credential Manager) |
| Build | tsup | Fast, zero-config TS bundler, ESM + CJS dual output |
| Test | vitest | Fast, native TS/ESM support, same config as Vite |
| Lint/Format | Biome | Fast, single tool for lint + format, no ESLint config hell |
| LSP | `vscode-languageserver` | Standard LSP protocol implementation |

## Folder Structure

```
vars/
├── turbo.json                    # Turborepo pipeline config
├── pnpm-workspace.yaml           # Workspace package list
├── package.json                  # Root — scripts, devDeps only
├── biome.json                    # Shared lint/format config
├── tsconfig.base.json            # Shared TS config (strict, ESM)
│
├── packages/
│   ├── core/                     # @vars/core — parser, crypto, validator
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts          # Public API: loadEnvx, Redacted, validate, etc.
│   │       ├── parser.ts         # .vars file parser (format rules from PRD §3.2)
│   │       ├── crypto.ts         # AES-256-GCM encrypt/decrypt, enc:v1:... format
│   │       ├── keymanager.ts     # PIN → Argon2id → wrapping key → master key
│   │       ├── keychain.ts       # OS keychain read/write/clear (via keytar)
│   │       ├── validator.ts      # Zod schema parsing + validation
│   │       ├── redacted.ts       # Redacted<T> type (~20 lines)
│   │       ├── resolver.ts       # Value resolution: env → default → parent → Zod default
│   │       ├── extends.ts        # @extends inheritance (max 3 levels, circular detection)
│   │       ├── codegen.ts        # Generate env.generated.ts from parsed .vars
│   │       ├── types.ts          # Shared types (VarsFile, Variable, EncryptedValue, etc.)
│   │       └── errors.ts         # Typed error classes (ParseError, ValidationError, etc.)
│   │
│   ├── cli/                      # @vars/cli — command-line tool
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts          # Entry point — citty main command
│   │       ├── commands/
│   │       │   ├── init.ts       # vars init — scan .env, infer types, generate .vars
│   │       │   ├── show.ts       # vars show — decrypt in-place
│   │       │   ├── hide.ts       # vars hide — encrypt in-place
│   │       │   ├── toggle.ts     # vars toggle — flip show/hide
│   │       │   ├── unlock.ts     # vars unlock — PIN → keychain
│   │       │   ├── lock.ts       # vars lock — clear keychain
│   │       │   ├── run.ts        # vars run -- <cmd> — decrypt in memory, inject, spawn
│   │       │   ├── check.ts      # vars check — validate + expiry/deprecation warnings
│   │       │   ├── gen.ts        # vars gen — generate typed accessors
│   │       │   ├── add.ts        # vars add <NAME> — interactive add
│   │       │   ├── remove.ts     # vars remove <NAME>
│   │       │   ├── ls.ts         # vars ls — list variables with metadata
│   │       │   ├── status.ts     # vars status — encrypted/decrypted, keychain state
│   │       │   ├── rotate.ts     # vars rotate — new master key + PIN
│   │       │   ├── diff.ts       # vars diff — cross-environment comparison
│   │       │   ├── push.ts       # vars push --vercel/--netlify/etc.
│   │       │   ├── pull.ts       # vars pull --vercel
│   │       │   ├── doctor.ts     # vars doctor — health check
│   │       │   ├── hook.ts       # vars hook install — git pre-commit
│   │       │   ├── template.ts   # vars template — generate .env from .vars
│   │       │   ├── typecheck.ts  # vars typecheck — scan for undefined process.env refs
│   │       │   ├── coverage.ts   # vars coverage — per-env completeness
│   │       │   ├── blame.ts      # vars blame <NAME> — git history
│   │       │   └── completions.ts # vars completions — shell completions
│   │       └── utils/
│   │           ├── prompt.ts     # Interactive prompts (PIN entry, confirmations)
│   │           └── format.ts     # CLI output formatting (errors, tables, etc.)
│   │
│   ├── lsp/                      # @vars/lsp — Language Server Protocol
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # LSP server entry
│   │       ├── diagnostics.ts    # Inline validation errors, warnings
│   │       ├── completion.ts     # Autocomplete (env names, Zod methods)
│   │       ├── hover.ts          # Hover info (schema type, metadata)
│   │       └── definition.ts     # Go-to-definition (@extends paths)
│   │
│   ├── vscode/                   # @vars/vscode — VS Code / Cursor extension
│   │   ├── package.json
│   │   └── src/
│   │       ├── extension.ts      # Activate/deactivate, launch LSP
│   │       └── syntaxes/
│   │           └── vars.tmLanguage.json  # TextMate grammar for .vars files
│   │
│   ├── next/                     # @vars/next
│   │   ├── package.json          # peerDeps: next
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts          # withEnvx() — decrypt, validate, inject, split NEXT_PUBLIC_*
│   │
│   ├── vite/                     # @vars/vite
│   │   ├── package.json          # peerDeps: vite
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts          # varsPlugin() — Vite plugin, replaces import.meta.env.*
│   │
│   ├── astro/                    # @vars/astro
│   │   ├── package.json          # peerDeps: astro
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts          # varsIntegration() — hooks into astro:config:setup
│   │
│   ├── nestjs/                   # @vars/nestjs
│   │   ├── package.json          # peerDeps: @nestjs/common, @nestjs/core
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts          # EnvxModule.forRoot() + @Inject(VARS)
│   │
│   └── turbo/                    # @vars/turbo
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts          # Turborepo utilities (check --all, gen --all, etc.)
```

## Key Dependencies

### @vars/core
```json
{
  "dependencies": {
    "zod": "^3.x",
    "argon2": "^0.x"
  },
  "devDependencies": {
    "tsup": "^8.x",
    "vitest": "^3.x",
    "typescript": "^5.x"
  }
}
```

### @vars/cli
```json
{
  "dependencies": {
    "@vars/core": "workspace:*",
    "citty": "^0.2.x"
  }
}
```

### Framework packages (e.g., @vars/next)
```json
{
  "dependencies": {
    "@vars/core": "workspace:*"
  },
  "peerDependencies": {
    "next": ">=14"
  }
}
```

## Build Pipeline (turbo.json)

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

Build order is automatic: `core` builds first (no deps), then `cli`/framework packages (depend on `core`), then `lsp` (depends on `core`), then `vscode` (depends on `lsp`).

## Output Format

All packages output:
- **ESM** (`dist/index.mjs`) — primary
- **CJS** (`dist/index.cjs`) — fallback for older tools
- **Types** (`dist/index.d.ts`)

Via tsup with `format: ['esm', 'cjs']` and `dts: true`.

## Testing Strategy

- **Unit tests** — `packages/*/src/__tests__/` — parser, crypto, validator, resolver
- **Integration tests** — `packages/cli/src/__tests__/` — full CLI command flows
- **Fixture files** — `packages/core/src/__tests__/fixtures/` — sample `.vars` files (encrypted + plaintext)
- **vitest workspaces** — each package has its own vitest config, turbo runs them in parallel
