<div align="center">
  <img src="./apps/docs/public/logo.svg" alt="vars logo" width="128" height="128" />
  <h1>vars</h1>
  <p><strong>Encrypted, typed, schema-first environment variables.</strong></p>
  <p>One file. Zero SaaS. AI-safe by default.</p>

  <a href="https://vars-docs.vercel.app">Documentation</a> ·
  <a href="https://vars-docs.vercel.app/docs/getting-started">Getting Started</a> ·
  <a href="https://marketplace.visualstudio.com/items?itemName=vars">VS Code Extension</a>
</div>

---

```
# config.vars — committed to git, secrets encrypted

# @vars-state locked
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number().min(1024).max(65535) = 3000

DATABASE_URL : z.string().url() {
  dev     = enc:v2:aes256gcm-det:x1y2z3...:a4b5c6...:d7e8f9...
  staging = enc:v2:aes256gcm-det:g1h2i3...:j4k5l6...:m7n8o9...
  prod    = enc:v2:aes256gcm-det:a1b2c3...:d4e5f6...:g7h8i9...
}
```

**Schema + values + environments in one file.** Secrets encrypted inline. Public values stay plaintext. [Zod](https://zod.dev) validates at build time.

---

### Why vars?

| `.env` files | vars |
|---|---|
| Plaintext secrets in git | Encrypted with AES-256-GCM |
| `process.env.PORT` is `string \| undefined` | `vars.PORT` is `number` |
| Runtime crashes from misconfigured envs | Build-time Zod validation |
| "DM me the .env" | One file, committed, encrypted |
| Separate file per environment | All envs in one file |
| AI agents can read your secrets | PIN-protected — humans only |

### Quick Start

```bash
npx vars init          # create config.vars + encryption key
vars show config.vars  # decrypt for editing
vars hide              # re-encrypt
vars run --env dev -- npm start
```

### Type Safety

```typescript
import { vars } from '#vars'

vars.APP_NAME              // string (public)
vars.PORT                  // number (public, coerced)
vars.DATABASE_URL          // Redacted<string> (secret)
vars.DATABASE_URL.unwrap() // explicit access
```

### What else?

vars has **composition** across files, **groups** for organization, **conditionals** for multi-region deployments, **check blocks** for cross-variable validation, and **platform targets** for Cloudflare/Deno/static builds.

**[Read the docs →](https://vars-docs.vercel.app)**

---

### CLI

```bash
vars init              # initialize project
vars gen <file>        # generate TypeScript types
vars show / hide       # decrypt / encrypt
vars run --env <env>   # run with injected env vars
vars check             # validate schemas + checks
vars ls                # list files and variables
vars diff --env a,b    # compare environments
vars export --env prod # export as dotenv/json/k8s-secret
vars key init          # create encryption key
vars doctor            # diagnose setup
```

### Packages

| Package | Description |
|---------|-------------|
| `@vars/core` | Parser, resolver, validator, codegen |
| `@vars/node` | Crypto, key management, file resolution |
| `@vars/cli` | CLI tool (`vars`) |
| `@vars/lsp` | Language Server Protocol |
| `@vars/vscode` | VS Code / Cursor extension |

### License

MIT
