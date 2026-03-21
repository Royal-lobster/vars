# Docs Content Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Branch:** `docs-content`

## Goal

Fill out the vars documentation site with 12 pages of content. The docs framework (Fumadocs) and homepage are already built — this spec covers the actual content that goes in `apps/docs/content/docs/`.

## Audience

Primary: individual developers who want to get running fast. Secondary: teams evaluating vars for adoption. Lead with quick wins, have depth available for those who need it.

## Site Navigation

```
Docs
├── Why vars?
├── Getting Started
├── File Format
├── CLI
│   ├── Setup & Auth
│   ├── Managing Variables
│   ├── Running Apps
│   └── Platform Integration
├── Framework Integrations
│   ├── Next.js
│   ├── Vite
│   ├── Astro
│   └── NestJS
└── Encryption & Security
```

12 pages total.

## Page Outlines

### Why vars?

The "aha moment" page. Opens with the problems of `.env` files — untyped, unencrypted, no validation, scattered across environments, easy to leak. Shows how vars flips each one: encrypted by default, Zod schemas inline, multi-env in one file, PIN-protected keys AI agents can't access. Ends with a side-by-side `.env` vs `.vars` comparison. Short, no code setup — just the mental model.

### Getting Started

Fast and dopamine-forward. Install, create your first `.vars` file, add a variable with a schema, encrypt it, run your app. Under 5 minutes, all CLI commands copy-pasteable. Ends with "now pick your framework" linking to the integration pages.

### File Format

The `.vars` DSL reference. Covers: variable declarations, Zod schema syntax, environment blocks (`@dev`, `@prod`, `@default`), encrypted values, comments, decorators. Quick spec with examples. The page people bookmark.

### CLI: Setup & Auth

Commands: `init`, `unlock`, `lock`, `doctor`, `completions`. How to bootstrap a project, manage the encryption key/PIN, run health checks, and set up shell completions.

### CLI: Managing Variables

Commands: `show`, `hide`, `add`, `remove`, `ls`, `toggle`. Day-to-day commands for viewing, adding, removing, and listing variables.

### CLI: Running Apps

Commands: `run`, `gen`, `check`, `typecheck`. How to inject vars into your app, generate typed accessors, validate schemas, and type-check your configuration.

### CLI: Platform Integration

Commands: `push`, `pull`, `template`. Syncing with deployment platforms and generating `.env` files for Docker/legacy tools via `template`. `template` is fully implemented. `push` and `pull` are scaffolded but **all platform adapters (Vercel, Netlify, Railway, Fly.io) are coming soon** — no adapters are implemented yet. Document the intended workflow and mark each platform as coming soon.

### Framework: Next.js

Install `@vars/next`, configure `next.config.ts`, access typed variables, gotchas/tips specific to Next.js.

### Framework: Vite

Install `@vars/vite`, configure `vite.config.ts`, works with SvelteKit/Nuxt/Remix too. Access typed variables, framework-specific tips.

### Framework: Astro

Install `@vars/astro`, configure `astro.config.mjs`, access typed variables, Astro-specific gotchas.

### Framework: NestJS

Install `@vars/nestjs`, configure as a NestJS module, inject typed variables, NestJS-specific patterns.

### Encryption & Security

How vars encrypts values (AES-256-GCM), the PIN/key model, why AI agents can't access secrets, the `Redacted<T>` type, threat model. The page teams care about when evaluating adoption.

## Tone & Writing Guidelines

- **Casual and punchy.** Short sentences. Contractions. "You're done." not "The configuration is now complete."
- **Lead with code.** Every page shows a working example in the first scroll. Explanations come after.
- **No walls of text.** If a section needs more than a short paragraph, break it into bullet points or a code block.
- **Run through humanizer skill** on all written content — strip AI-sounding patterns (promotional language, em dashes, rule of three, inflated phrasing).
- **Use the homepage comparison style** — `.env` problems vs `.vars` solutions — wherever it helps land a point.
- **"Coming soon" is fine.** For push/pull adapters, be upfront. Don't pretend it's done.
- **No jargon gatekeeping.** If you mention AES-256-GCM, explain what it means in plain English right after.

## File Tree

```
apps/docs/content/docs/
├── meta.json
├── index.mdx              # Getting Started
├── why-vars.mdx
├── file-format.mdx
├── cli/
│   ├── meta.json
│   ├── setup-auth.mdx
│   ├── managing-variables.mdx
│   ├── running-apps.mdx
│   └── platform-integration.mdx
├── frameworks/
│   ├── meta.json
│   ├── nextjs.mdx
│   ├── vite.mdx
│   ├── astro.mdx
│   └── nestjs.mdx
└── encryption-security.mdx
```

## Navigation (`meta.json` contents)

**Root** (`apps/docs/content/docs/meta.json`):
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

**CLI** (`apps/docs/content/docs/cli/meta.json`):
```json
{
  "pages": ["setup-auth", "managing-variables", "running-apps", "platform-integration"]
}
```

**Frameworks** (`apps/docs/content/docs/frameworks/meta.json`):
```json
{
  "pages": ["nextjs", "vite", "astro", "nestjs"]
}
```

## Scope

This is a "broad coverage" pass (12 pages). Future expansion to comprehensive coverage (CI/CD guides, team workflows, migration from .env, LSP/editor setup, troubleshooting) is planned but out of scope here.

### CLI commands in scope (18 of 25)

`init`, `unlock`, `lock`, `doctor`, `completions`, `show`, `hide`, `add`, `remove`, `ls`, `toggle`, `run`, `gen`, `check`, `typecheck`, `push`, `pull`, `template`.

### CLI commands deferred to future expansion

`blame`, `coverage`, `diff`, `history`, `hook`, `rotate`, `status` — these are useful but secondary. They'll be added in the comprehensive pass.

### Packages deferred

- `@vars/turbo` — Turborepo integration, docs deferred to comprehensive pass.
- `@vars/lsp` / `@vars/vscode` — editor/LSP setup, deferred to comprehensive pass.
- `@vars/core` — internal package, referenced from framework pages where relevant but no dedicated docs page.

## Cleanup

Remove `PRD.md` from the repo as part of this PR — it's outdated and the docs will replace it as the source of truth.

## Content Location

All content goes in `apps/docs/content/docs/` as `.mdx` files, organized with `meta.json` files for Fumadocs navigation.
