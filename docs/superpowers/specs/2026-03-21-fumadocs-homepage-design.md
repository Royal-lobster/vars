# Fumadocs + Homepage Design Spec

**Date:** 2026-03-21
**Status:** Implemented

## Overview

Fumadocs documentation site in `apps/docs` with a custom homepage featuring generative AI illustrations, custom `.vars` syntax highlighting, and a dark green-accented aesthetic.

## Architecture

- **Framework:** Next.js 15 + React 19 (via Fumadocs)
- **Packages:** `fumadocs-mdx@14`, `fumadocs-core@15`, `fumadocs-ui@15`, `@types/mdx`
- **Styling:** Tailwind CSS v4 + `fumadocs-ui/css/shadcn.css` (fumadocs derives theme from shadcn variables — single source of truth)
- **UI Components:** shadcn/ui (Button, Card, Badge, Separator)
- **Icons:** `@icons-pack/react-simple-icons` for framework logos
- **Code Highlighting:** Shiki via fumadocs `DynamicCodeBlock` + custom `.vars` TextMate grammar
- **AI Integration:** LLM endpoints (`/llms.txt`, `/llms-full.txt`)

### Version Compatibility Note

fumadocs-core/ui v16 requires React 19.1+ (`useEffectEvent`), which Next.js 15 doesn't ship. Pinned to v15 for compatibility. fumadocs-mdx v14 generates the correct `.source/` output.

## Monorepo Changes

- `pnpm-workspace.yaml` — added `apps/*`
- `turbo.json` — added `.next/**` to build outputs, added `dev` task
- `.gitignore` — added `.next/`, `.source/`, `.superpowers/`

## Homepage Design

### Aesthetic

- Dark mode (`#050505` base), green accent (`#22c55e`)
- Fonts: Instrument Sans (body), JetBrains Mono (code), Newsreader (italic accents)
- Generative AI illustrations (Recraft V3) as atmospheric card/section backgrounds
- 7 images stored in `public/images/`

### Sections (top to bottom)

1. **Nav** — fumadocs `HomeLayout` with branded logo (green gradient `{ }` badge), docs link, GitHub
2. **Hero** — Full-bleed generative background (green sunrise), "Stop leaking secrets in *plaintext.*", animated pulse badge, `.vars` code preview with custom grammar highlighting, green CTA buttons
3. **Social proof ticker** — AES-256-GCM · Zod · 6 plugins · LSP · AI-safe (with separators)
4. **Full-width feature** — Encryption deep-dive, 2-column grid with fluid-green image + floating code overlay
5. **Comparison** — `.env` vs `.vars` side-by-side: `.env` uses `DynamicCodeBlock` (bash lang), `.vars` uses `VarsDynamicCodeBlock` (custom grammar). Red-tinted vs green-tinted cards. Problem/benefit bullet lists below each.
6. **Bento grid** — 12-column grid with varied spans (8/4, 4/8, 12-wide). Schema-first (Zod TS snippets via DynamicCodeBlock), multi-env, CLI, LSP, refinements (custom grammar). Hover scale on images.
7. **Framework support** — 3-column grid, real SVG logos from `react-simple-icons` (Next.js, Vite, Astro, NestJS, SvelteKit, Nuxt). Full integration code snippets via `DynamicCodeBlock` (JS/TS). Hover lift effect.
8. **CTA** — "Replace .env *today.*" with radial green glow, primary button + `npx vars init` code
9. **Footer** — 4-column grid: brand (logo + tagline), product links, integration links, community links + copyright

### Responsive

- All grids collapse to single column on mobile (768px breakpoint)
- Font sizes use `clamp()` for fluid scaling
- Nav collapses on mobile (fumadocs handles this)
- Padding adjusts via `--px` CSS variable

## Syntax Highlighting

### Custom `.vars` TextMate Grammar (`lib/vars-lang.ts`)

Token scopes:
- `variable.other.vars` — Variable names (`DATABASE_URL`, `PORT`)
- `support.function.vars` — Zod schemas (`z.string().url()`)
- `keyword.control.vars` — Environment decorators (`@dev`, `@prod`)
- `entity.name.tag.vars` — Directives (`@refine`, `@extends`)
- `variable.parameter.vars` — Metadata (`@description`, `@owner`, `@expires`)
- `storage.type.vars` — Encrypted values (`enc:v1:aes256gcm:...`)
- `comment.line.vars` — Comments (`// ...`)
- `string.quoted.vars` — Strings
- `keyword.operator.vars` — Operators (`=>`, `||`, `!==`)

### Usage

- `VarsDynamicCodeBlock` — wrapper that registers custom lang + passes to fumadocs `DynamicCodeBlock`
- Used in: hero, comparison (.vars side), bento (refinements)
- Standard `DynamicCodeBlock` used for: comparison (.env side, bash), bento (Zod, TS), frameworks (JS/TS)

## Theming

Single source of truth: shadcn CSS variables in `global.css`.

- `fumadocs-ui/css/shadcn.css` makes fumadocs derive its `--color-fd-*` from shadcn vars
- Dark theme: near-black bg (`oklch(0.08)`), green primary (`oklch(0.72 0.19 150)`), green ring/accent
- Docs pages inherit the same dark green aesthetic as homepage

## File Structure

```
apps/docs/
├── package.json
├── next.config.mjs
├── source.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── components.json                    # shadcn config
├── app/
│   ├── layout.tsx                     # Root: RootProvider, fonts, forced dark mode
│   ├── global.css                     # Tailwind v4 + shadcn.css + fumadocs preset
│   ├── (home)/
│   │   ├── layout.tsx                 # HomeLayout wrapper
│   │   └── page.tsx                   # Homepage assembling all sections
│   ├── docs/
│   │   ├── layout.tsx                 # DocsLayout + sidebar tree
│   │   └── [[...slug]]/
│   │       └── page.tsx               # Docs page (fumadocs-ui/page imports)
│   ├── llms.txt/route.ts              # LLM index endpoint
│   └── llms-full.txt/route.ts         # LLM full text endpoint
├── components/
│   ├── mdx.tsx                        # MDX component provider
│   ├── ui/                            # shadcn: button, card, badge, separator
│   └── homepage/
│       ├── hero.tsx
│       ├── ticker.tsx
│       ├── feature-encryption.tsx
│       ├── comparison.tsx
│       ├── bento.tsx
│       ├── frameworks.tsx
│       ├── cta.tsx
│       ├── footer.tsx
│       ├── vars-codeblock.tsx         # VarsDynamicCodeBlock wrapper
│       └── code-block.tsx             # Legacy manual token code block (unused)
├── lib/
│   ├── source.ts                      # Fumadocs source loader
│   ├── layout.shared.tsx              # Shared nav config (branded logo)
│   ├── fonts.ts                       # Instrument Sans, JetBrains Mono, Newsreader
│   ├── utils.ts                       # cn() utility (clsx + tailwind-merge)
│   ├── shiki.ts                       # Custom Shiki theme (unused — using fumadocs default)
│   └── vars-lang.ts                   # Custom .vars TextMate grammar
├── content/docs/
│   ├── index.mdx                      # Getting started placeholder
│   └── meta.json                      # Sidebar ordering
└── public/images/
    ├── hero-bg.webp                   # Green sunrise (Recraft V3)
    ├── fluid-green.webp               # Bioluminescent fluid
    ├── topographic.webp               # Green contour map
    ├── crystal.webp                   # Crystal formation
    ├── fireflies.webp                 # Particle field
    ├── aurora.webp                    # Aurora prism
    └── neural-mesh.webp              # Neural network sphere
```

## Generated Images

7 Recraft V3 `neon_calm` / `handmade_3d` / `noir` illustrations with brand green (`#22c55e`) color parameter:
- `hero-bg.webp` — Green sunrise panorama (hero background)
- `fluid-green.webp` — Bioluminescent fluid tendrils (encryption section)
- `topographic.webp` — Green contour map (schema section)
- `crystal.webp` — Crystal formation (refinements section)
- `fireflies.webp` — Particle field (multi-env section)
- `aurora.webp` — Aurora prism refraction (CLI section)
- `neural-mesh.webp` — Neural network sphere (LSP section)

## Out of Scope

- Documentation content (future task)
- Blog setup
- Search integration (Orama — deferred, needs structured data config)
- i18n
- Per-page `.mdx` content negotiation endpoint
