# Docs Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write 12 pages of documentation content for the vars docs site.

**Architecture:** All content lives in `apps/docs/content/docs/` as `.mdx` files with Fumadocs `meta.json` navigation. Pages are written in casual, punchy tone. Each page runs through the humanizer skill before commit. Content is derived from actual CLI source code and framework package implementations.

**Tech Stack:** MDX, Fumadocs, Zod (examples), shell commands

**Spec:** `docs/superpowers/specs/2026-03-21-docs-content-design.md`

---

### Task 1: Scaffold navigation and meta.json files

**Files:**
- Modify: `apps/docs/content/docs/meta.json`
- Create: `apps/docs/content/docs/cli/meta.json`
- Create: `apps/docs/content/docs/frameworks/meta.json`

- [ ] **Step 1: Update root meta.json**

```json
{
  "root": true,
  "pages": [
    "why-vars",
    "---Getting Started---",
    "index",
    "file-format",
    "---CLI---",
    "...cli",
    "---Frameworks---",
    "...frameworks",
    "---",
    "encryption-security"
  ]
}
```

- [ ] **Step 2: Create CLI meta.json**

Create `apps/docs/content/docs/cli/meta.json`:
```json
{
  "pages": ["setup-auth", "managing-variables", "running-apps", "platform-integration"]
}
```

- [ ] **Step 3: Create Frameworks meta.json**

Create `apps/docs/content/docs/frameworks/meta.json`:
```json
{
  "pages": ["nextjs", "vite", "astro", "nestjs"]
}
```

- [ ] **Step 4: Verify dev server renders the nav**

Run: `cd apps/docs && pnpm dev`
Expected: Sidebar shows the full nav structure (pages will 404 until written, that's fine)

- [ ] **Step 5: Commit**

```bash
git add apps/docs/content/docs/meta.json apps/docs/content/docs/cli/meta.json apps/docs/content/docs/frameworks/meta.json
git commit -m "docs: scaffold navigation meta.json files"
```

---

### Task 2: Write "Why vars?" page

**Files:**
- Create: `apps/docs/content/docs/why-vars.mdx`

This is the most important page. It sells the mental model. Structure:

1. Open with the pain of `.env` files (3-4 bullet points, no fluff)
2. Show how vars fixes each one (encrypted, typed, multi-env, safe from AI agents)
3. Side-by-side comparison: `.env` approach vs `.vars` approach
4. Close with "Ready? Let's go" linking to Getting Started

- [ ] **Step 1: Write the page**

Create `apps/docs/content/docs/why-vars.mdx`:

```mdx
---
title: Why vars?
description: Your .env files are a liability. Here's why vars exists.
---

## The problem with .env

If you're using `.env` files, you're probably dealing with some of these:

- **No encryption.** Secrets sit in plaintext. One bad `git push` and they're public.
- **No types.** That `PORT` is a string. That `ENABLE_FEATURE` is a string. Everything is a string.
- **No validation.** Typo in your database URL? You'll find out at runtime. In prod.
- **One file per environment.** `.env.local`, `.env.staging`, `.env.production` — scattered across your repo, drift guaranteed.
- **AI agents can read them.** Any tool with file access can grab your secrets.

## How vars fixes this

vars is a drop-in replacement for `.env` that encrypts everything, validates with Zod schemas, and keeps all environments in one file.

**Encrypted by default.** Every value is AES-256-GCM encrypted. Your `.vars` file is safe to commit. No more `.gitignore` anxiety.

**Typed with Zod.** Schemas live next to the values. `z.string().url()` catches that typo before your app boots.

**Multi-environment.** Dev, staging, prod — all in one file under `@env` blocks. No more file sprawl.

**PIN-protected.** Your encryption key is locked behind a PIN. AI agents, CI scripts, and random tools can't decrypt without it.

## .env vs .vars

Here's what managing a database URL looks like:

**The .env way:**

```bash
# .env.development
DATABASE_URL=postgres://localhost/myapp

# .env.production (hope nobody commits this)
DATABASE_URL=postgres://prod-host/myapp
```

No types. No validation. Two files. Plaintext secrets.

**The vars way:**

```
DATABASE_URL  z.string().url().startsWith("postgres://")
  @dev     = enc:v1:aes256gcm:a1b2c3...:d4e5f6...:g7h8i9...
  @prod    = enc:v1:aes256gcm:j8fn2p...:t9u0v1...:w2x3y4...
```

Typed. Validated. Encrypted. One file.

## Ready?

[Get started in under 5 minutes →](/docs)
```

- [ ] **Step 2: Run humanizer skill on the content**

Use `@humanizer` skill to review and clean the page of AI-sounding patterns.

- [ ] **Step 3: Verify it renders**

Run: `cd apps/docs && pnpm dev`
Navigate to the "Why vars?" page. Check formatting, links, code blocks.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/why-vars.mdx
git commit -m "docs: add 'Why vars?' page"
```

---

### Task 3: Rewrite "Getting Started" page

**Files:**
- Modify: `apps/docs/content/docs/index.mdx`

The existing page is a bare skeleton. Rewrite to be the fast, dopamine-forward experience. Structure:

1. Install with one command
2. Your first `.vars` file — add a variable with a Zod schema
3. Add values for dev and prod environments
4. Encrypt it
5. Run your app with injected vars
6. Generate typed accessors
7. "Pick your framework" links

Important context from source code:
- `vars init` prompts for PIN, can import from existing `.env`, creates `.vars/vault.vars` and `.vars/key`
- `vars show` decrypts for editing, `vars hide` re-encrypts
- `vars run --env dev -- node server.js` injects decrypted values
- `vars gen` outputs `env.generated.ts`

- [ ] **Step 1: Rewrite the page**

Replace `apps/docs/content/docs/index.mdx` with:

```mdx
---
title: Getting Started
description: Get up and running with vars in under 5 minutes.
---

## Install

```bash
npx vars init
```

This does three things:
- Creates `.vars/vault.vars` (your encrypted variables file)
- Creates `.vars/key` (your encryption key, PIN-protected)
- Updates `.gitignore` so secrets never get committed

Already have a `.env` file? `vars init` will offer to import it.

## Add a variable

Decrypt your vault so you can edit it:

```bash
npx vars show
```

Open `.vars/unlocked.vars` and add your first variable:

```
DATABASE_URL  z.string().url()
  @dev  = postgres://localhost/myapp
  @prod = postgres://prod-host/myapp
```

That's a Zod schema right next to the variable name. If the value doesn't match, vars will tell you.

## Encrypt

When you're done editing:

```bash
npx vars hide
```

All values get encrypted with AES-256-GCM. The file is safe to commit.

## Run your app

Inject decrypted variables into any command:

```bash
npx vars run --env dev -- node server.js
```

Secrets are decrypted in memory and passed as environment variables. Nothing hits disk.

## Generate typed accessors

```bash
npx vars gen
```

This creates `env.generated.ts` with typed exports for every variable. No more `process.env.MAYBE_EXISTS`.

## Next steps

Pick your framework:

- [Next.js](/docs/frameworks/nextjs)
- [Vite](/docs/frameworks/vite) (also works with SvelteKit, Nuxt, Remix)
- [Astro](/docs/frameworks/astro)
- [NestJS](/docs/frameworks/nestjs)

Or dive into the [file format](/docs/file-format) and [CLI reference](/docs/cli/setup-auth).
```

- [ ] **Step 2: Run humanizer skill on the content**

- [ ] **Step 3: Verify it renders**

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/index.mdx
git commit -m "docs: rewrite Getting Started page"
```

---

### Task 4: Write "File Format" page

**Files:**
- Create: `apps/docs/content/docs/file-format.mdx`

This is the reference page. Derive all syntax from the parser in `packages/core/src/parser.ts`. Cover:

1. Variable declarations (name + Zod schema)
2. Environment blocks (`@dev`, `@prod`, `@default`)
3. Encrypted values format (`enc:v1:aes256gcm:...`)
4. Comments (`# ...`)
5. Decorators/metadata (`@deprecated`, `@expires`, `@owner`, `@refine`, `@description`)
6. Complete example putting it all together

- [ ] **Step 1: Read the parser source for accuracy**

Read: `packages/core/src/parser.ts`
Understand the exact syntax rules before writing docs.

- [ ] **Step 2: Write the page**

Create `apps/docs/content/docs/file-format.mdx`. Lead with a complete example, then break down each part. Use the `.vars` syntax highlighting that's already set up in the docs site (`lib/vars-lang.ts`).

- [ ] **Step 3: Run humanizer skill**

- [ ] **Step 4: Verify it renders**

- [ ] **Step 5: Commit**

```bash
git add apps/docs/content/docs/file-format.mdx
git commit -m "docs: add File Format reference page"
```

---

### Task 5: Write CLI "Setup & Auth" page

**Files:**
- Create: `apps/docs/content/docs/cli/setup-auth.mdx`

Commands to cover:
- `init` — bootstrap a project, import from `.env`, set PIN
- `doctor` — run health checks (files, security, secrets health)
- `completions` — generate shell completions for bash/zsh/fish
- `unlock` / `lock` — mention these are deprecated (PIN is now prompted per-command)

Important source context:
- `init` has `--file` (path to .env) and `--env` (environment name, default: dev) flags
- `doctor` runs 3 check groups: Files, Security, Secrets Health. Exits 1 on failure.
- `completions` takes a positional arg: `bash`, `zsh`, or `fish`

- [ ] **Step 1: Write the page**

Structure: brief intro, then each command with usage, flags, and what it does. For `unlock`/`lock`, a short note that they're deprecated.

- [ ] **Step 2: Run humanizer skill**

- [ ] **Step 3: Verify it renders**

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/cli/setup-auth.mdx
git commit -m "docs: add CLI Setup & Auth page"
```

---

### Task 6: Write CLI "Managing Variables" page

**Files:**
- Create: `apps/docs/content/docs/cli/managing-variables.mdx`

Commands to cover:
- `show` — decrypt vault → `unlocked.vars` for editing. Flags: `--file`. Runs gitignore + pre-commit safety checks.
- `hide` — re-encrypt → `vault.vars`. Flags: `--file`. All-or-nothing encryption. Auto-regenerates `env.generated.ts`.
- `add` — add variable with schema + encrypted values for multiple envs. Flags: `--schema`, `--file`. Prompts for each env value.
- `remove` — remove variable + all env values. Flags: `--yes` (skip confirm), `--file`.
- `ls` — list all variables with schemas, envs, metadata. Flags: `--file`.
- `toggle` — flip between show/hide in one command. Flags: `--file`.

- [ ] **Step 1: Write the page**

Structure: the show/hide workflow first (that's the core loop), then add/remove, then ls and toggle.

- [ ] **Step 2: Run humanizer skill**

- [ ] **Step 3: Verify it renders**

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/cli/managing-variables.mdx
git commit -m "docs: add CLI Managing Variables page"
```

---

### Task 7: Write CLI "Running Apps" page

**Files:**
- Create: `apps/docs/content/docs/cli/running-apps.mdx`

Commands to cover:
- `run` — decrypt + inject into child process. Usage: `vars run --env <env> -- <command> [args...]`. Sets `VARS_ENV`. Never writes to disk.
- `gen` — generate `env.generated.ts` (or custom path via `--output`). `--lang` flag (only `ts` for now).
- `check` — validate values against Zod schemas. Optional `--env` flag. Checks: missing required values, schema conformance, expired/deprecated secrets, `@refine` cross-validations. Exits 1 on errors.
- `typecheck` — scan codebase for `process.env` and `import.meta.env` refs not in `.vars`. `--dir` flag (default: `src`). Scans `.ts/.tsx/.js/.jsx/.mts/.cts`.

- [ ] **Step 1: Write the page**

Lead with `run` (the most common command), then `gen`, then `check` and `typecheck`.

- [ ] **Step 2: Run humanizer skill**

- [ ] **Step 3: Verify it renders**

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/cli/running-apps.mdx
git commit -m "docs: add CLI Running Apps page"
```

---

### Task 8: Write CLI "Platform Integration" page

**Files:**
- Create: `apps/docs/content/docs/cli/platform-integration.mdx`

Commands to cover:
- `template` — generate `.env` from `.vars`. Fully implemented. Usage: `vars template --env prod > .env.production`. Outputs to stdout. Quotes values with spaces/special chars.
- `push` — push decrypted vars to platform. Coming soon. Flags: `--vercel`, `--netlify`, `--railway`, `--fly`. Usage: `vars push --env prod --vercel`.
- `pull` — pull from platform, encrypt, merge. Coming soon. Flags: `--vercel`, `--netlify`. Usage: `vars pull --vercel`.

- [ ] **Step 1: Write the page**

Lead with `template` (it works now). Then push/pull with "coming soon" badges. Show the intended workflow even though adapters aren't built.

- [ ] **Step 2: Run humanizer skill**

- [ ] **Step 3: Verify it renders**

- [ ] **Step 4: Commit**

```bash
git add apps/docs/content/docs/cli/platform-integration.mdx
git commit -m "docs: add CLI Platform Integration page"
```

---

### Task 9: Write framework integration pages (Next.js + Vite)

**Files:**
- Create: `apps/docs/content/docs/frameworks/nextjs.mdx`
- Create: `apps/docs/content/docs/frameworks/vite.mdx`

**Next.js page** — source: `packages/next/src/index.ts`
- Install: `pnpm add @vars/next`
- Configure: wrap config with `withEnvx()` in `next.config.ts`
- Options: `envFile`, `env`, `key`
- Client vars: `NEXT_PUBLIC_*` prefix auto-splits to client
- Auto-regenerates `env.generated.ts` on changes
- Validates with Zod at build time

**Vite page** — source: `packages/vite/src/index.ts`
- Install: `pnpm add @vars/vite`
- Configure: add `varsPlugin()` to `vite.config.ts` plugins
- Options: `envFile`, `env`, `key`
- Client vars: `VITE_*` prefix via `import.meta.env`
- Watches `.vars` file, restarts dev server on changes
- Works with SvelteKit, Nuxt, Remix

- [ ] **Step 1: Read framework package sources for accuracy**

Read: `packages/next/src/index.ts` and `packages/vite/src/index.ts`
Confirm export names (`withEnvx`, `varsPlugin`), options, and client-side variable prefix behavior.

- [ ] **Step 2: Write Next.js page**

Structure: install → configure → access variables → client vs server → gotchas.

- [ ] **Step 3: Write Vite page**

Same structure. Note SvelteKit/Nuxt/Remix compatibility.

- [ ] **Step 4: Run humanizer skill on both pages**

- [ ] **Step 5: Verify both render**

- [ ] **Step 6: Commit**

```bash
git add apps/docs/content/docs/frameworks/nextjs.mdx apps/docs/content/docs/frameworks/vite.mdx
git commit -m "docs: add Next.js and Vite framework integration pages"
```

---

### Task 10: Write framework integration pages (Astro + NestJS)

**Files:**
- Create: `apps/docs/content/docs/frameworks/astro.mdx`
- Create: `apps/docs/content/docs/frameworks/nestjs.mdx`

**Astro page** — source: `packages/astro/src/index.ts`
- Install: `pnpm add @vars/astro`
- Configure: add `varsIntegration()` to `astro.config.mts` integrations
- Options: `envFile`, `env`, `key`
- Client vars: `PUBLIC_*` prefix (Astro convention, not `VITE_*`)
- Hooks into `astro:config:setup`

**NestJS page** — source: `packages/nestjs/src/index.ts`
- Install: `pnpm add @vars/nestjs`
- Configure: `EnvxModule.forRoot({ env: 'production' })` in AppModule imports
- Options: `envFile`, `env`, `key`
- Access: inject via `@Inject(VARS)` token
- Global module — any service can inject it
- Server-only (no client-side concept in NestJS)

- [ ] **Step 1: Read framework package sources for accuracy**

Read: `packages/astro/src/index.ts` and `packages/nestjs/src/index.ts`
Confirm export names (`varsIntegration`, `EnvxModule`, `VARS`), options, and config file extension expectations.

- [ ] **Step 2: Write Astro page**

- [ ] **Step 3: Write NestJS page**

Note DI pattern — different from the other frameworks.

- [ ] **Step 4: Run humanizer skill on both pages**

- [ ] **Step 5: Verify both render**

- [ ] **Step 6: Commit**

```bash
git add apps/docs/content/docs/frameworks/astro.mdx apps/docs/content/docs/frameworks/nestjs.mdx
git commit -m "docs: add Astro and NestJS framework integration pages"
```

---

### Task 11: Write "Encryption & Security" page

**Files:**
- Create: `apps/docs/content/docs/encryption-security.mdx`

Derive from `packages/core/src/crypto.ts` and `packages/core/src/redacted.ts`. Cover:

1. **How encryption works** — AES-256-GCM, 12-byte random IV per value, 16-byte auth tag. Format: `enc:v1:aes256gcm:<iv>:<ciphertext>:<tag>`. Explain in plain English: "each value is independently encrypted with a unique random number, and the auth tag proves nobody tampered with it."
2. **The PIN/key model** — master key stored in `.vars/key`, protected by PIN. PIN is prompted per-command (not cached). Key never leaves disk unencrypted.
3. **Why AI agents can't access secrets** — the PIN prompt is interactive (TTY), automated tools can't answer it.
4. **Redacted<T> type** — wraps sensitive values. `toString()`, `toJSON()`, inspect all return `"<redacted>"`. Only `unwrap()` gives the real value. Prevents accidental logging.
5. **Threat model** — what vars protects against (accidental commits, log leaks, unauthorized file access) and what it doesn't (compromised machine with the PIN, memory dumps).

- [ ] **Step 1: Read crypto.ts and redacted.ts for accuracy**

Read: `packages/core/src/crypto.ts` and `packages/core/src/redacted.ts`

- [ ] **Step 2: Write the page**

Lead with a plain-English summary, then drill into each section. No jargon without explanation.

- [ ] **Step 3: Run humanizer skill**

- [ ] **Step 4: Verify it renders**

- [ ] **Step 5: Commit**

```bash
git add apps/docs/content/docs/encryption-security.mdx
git commit -m "docs: add Encryption & Security page"
```

---

### Task 12: Remove PRD.md and final cleanup

**Files:**
- Delete: `PRD.md`

- [ ] **Step 1: Remove PRD.md**

```bash
git rm PRD.md
```

- [ ] **Step 2: Verify all 12 pages render in the docs site**

Run: `cd apps/docs && pnpm dev`
Walk through every page in the sidebar. Check:
- All links work
- Code blocks render correctly
- Navigation order matches the spec
- No broken references

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: remove outdated PRD.md"
```
