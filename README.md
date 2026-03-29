<div align="center">
  <img src="./apps/docs/public/logo.svg" alt="vars logo" width="128" height="128" />
  <h1>vars</h1>
  <p><strong>Encrypted, typed, schema-first environment variables.</strong></p>
  <p>One file. Zero SaaS. AI-safe by default.</p>

  <a href="https://vars-docs.vercel.app">Documentation</a> ·
  <a href="https://vars-docs.vercel.app/docs/getting-started">Getting Started</a> ·
  <a href="https://marketplace.visualstudio.com/items?itemName=srujangurram.dotvars-vscode">VS Code Extension</a>
</div>

---

Your team shares secrets over Slack. Your `.env.production` lives on three laptops — two are outdated. Every AI coding agent on your machine can read your plaintext secrets. This isn't a workflow problem. It's a compounding risk.

**vars replaces `.env` with a single encrypted config file that's safe to commit.**

Here's what you actually work with:

```hcl
# config.vars — what you edit

env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev  = "postgres://localhost:5432/myapp"
  prod = "postgres://admin@prod.db.internal:5432/myapp"
}

API_KEY : z.string().min(32) {
  dev  = "dev_key_a1b2c3d4e5f6g7h8i9j0k1l2m3"
  prod = "prod_key_x9y8w7v6u5t4s3r2q1p0o9n8m7"
} (description = "Primary API key", expires = 2026-09-01)
```

When you commit, secret values are encrypted. Public values stay readable:

```hcl
# config.vars — what git sees

DATABASE_URL : z.string().url() {
  dev  = enc:v2:aes256gcm-det:7f3a9b...:d4e5f6...:g7h8i9...
  prod = enc:v2:aes256gcm-det:e8d1f0...:k5l6m7...:n8o9p0...
}
```

The encryption key is locked behind a PIN. AI agents can see variable names and schemas — but not secret values.

---

### 🚀 Quick Start

```bash
npm i -g dotvars           # install globally (or use npx)

vars init                  # create config, set PIN
vars show config.vars      # decrypt for editing
# ... edit in your IDE ...
vars hide                  # encrypt secrets
vars run --env dev -- npm start
```

### 🔌 Works With Your Stack

vars wraps your dev and build commands — it works with any framework out of the box:

```json
{
  "scripts": {
    "dev": "vars run --env dev -- next dev",
    "build": "vars run --env prod -- next build"
  }
}
```

**Next.js** · **Vite** · **Astro** · **Remix** · **SvelteKit** · **Nuxt** · **Express** · **Hono** · **Fastify** — if it reads `process.env`, vars works. No adapters, no plugins.

### 🔒 Type Safety

Schemas are [Zod](https://zod.dev) expressions — think of them as type annotations that also validate at runtime:

```typescript
import { vars } from '#vars'

vars.APP_NAME              // string (public — plain value)
vars.PORT                  // number (public — auto-coerced)
vars.DATABASE_URL          // Redacted<string> (secret — safe to log)
vars.DATABASE_URL.unwrap() // actual value (explicit opt-in)
```

### ✨ Features

- 🔐 **Encryption** — Secrets encrypted in-file with AES-256-GCM, locked behind a PIN. Safe to commit to git
- 🤖 **AI-safe** — Variable names & schemas visible, secret values hidden from coding agents
- 🧩 **Schema-first** — Zod expressions as type annotations, validated at runtime
- 🔒 **Type safety** — Generated TypeScript types, secrets wrapped in `Redacted<string>` (explicit `.unwrap()`)
- 🌍 **Multi-environment** — Define `dev`, `staging`, `prod` values in one file with per-env overrides
- 📁 **Single file** — One `.vars` file replaces scattered `.env.*` files
- 🔌 **Framework agnostic** — Works with Next.js, Vite, Express, Hono, anything that reads `process.env`
- 📦 **File composition** — [Import and compose](https://vars-docs.vercel.app/docs/file-format#imports) across services and monorepos
- 🏷️ **Groups & conditionals** — [Organize vars into groups](https://vars-docs.vercel.app/docs/file-format#groups), use [conditionals](https://vars-docs.vercel.app/docs/file-format#conditionals) for multi-region setups
- ✅ **Check blocks** — [Cross-variable validation](https://vars-docs.vercel.app/docs/file-format#check-blocks) rules
- ☁️ **Platform targets** — [Cloudflare, Deno, static builds](https://vars-docs.vercel.app/docs/cli/running-apps)
- 🔄 **Show/Hide toggle** — Decrypt to edit, encrypt when done
- 🚀 **CLI runner** — `vars run --env dev -- npm start` injects env vars
- 📊 **Diff & export** — Compare environments, export as dotenv/JSON/k8s-secret
- 🧠 **VS Code extension** — Syntax highlighting + LSP support

**[Read the docs →](https://vars-docs.vercel.app)**

---

<details>
<summary>🛠️ CLI Commands</summary>

```bash
vars init              # initialize project
vars gen <file>        # generate TypeScript types
vars show / hide       # decrypt / encrypt
vars run --env <env>   # run with injected env vars
vars check             # validate schemas + checks
vars ls                # list files and variables
vars export --env prod # export as dotenv/json/k8s-secret
vars key init          # create encryption key
vars doctor            # diagnose setup
```

</details>

<details>
<summary>📦 Packages</summary>

| Package | Description |
|---------|-------------|
| `@vars/core` | Parser, resolver, validator, codegen |
| `@vars/node` | Crypto, key management, file resolution |
| `@vars/cli` | CLI tool (`vars`) |
| `@vars/lsp` | Language Server Protocol |
| `@vars/vscode` | VS Code / Cursor extension |

</details>

### 📄 License

MIT
