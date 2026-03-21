# Fumadocs + Homepage Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Set up Fumadocs documentation site in `apps/docs` with a custom homepage featuring generative AI illustrations and a dark, modern aesthetic (Linear-inspired with green accent).

## Architecture

- **Framework:** Next.js (via Fumadocs)
- **Packages:** `fumadocs-mdx`, `fumadocs-core`, `fumadocs-ui`, `@types/mdx`
- **Styling:** Tailwind CSS v4 + fumadocs-ui Tailwind plugin
- **AI Integration:** LLM endpoints (`llms.txt`, `llms-full.txt`, per-page `.mdx`)

## Monorepo Changes

- Add `apps/*` to `pnpm-workspace.yaml`
- Add `apps/docs` Next.js project
- Update `turbo.json` if needed

## Homepage Design

### Aesthetic

- Dark mode (#050505 base), green accent (#22c55e)
- Fonts: Instrument Sans (body), JetBrains Mono (code), Newsreader (italic accents)
- Generative AI illustrations (Recraft V3) as atmospheric card/section backgrounds
- Production images stored in `public/images/`

### Sections (top to bottom)

1. **Nav** — Logo, docs/blog/showcase links, ⌘K search, GitHub
2. **Hero** — Full-bleed generative background, "Stop leaking secrets in *plaintext.*", animated badge, .vars code preview, CTA buttons
3. **Social proof ticker** — AES-256-GCM · Zod · 6 plugins · LSP · AI-safe
4. **Full-width feature** — Encryption deep-dive with image + overlay code
5. **Comparison** — `.env` vs `.vars` side-by-side (red ✕ vs green ✓)
6. **Bento grid** — Schema-first, multi-env, CLI, LSP, refinements (varied column spans: 8/4, 4/8, 12-wide)
7. **Framework support** — Next.js, Vite, Astro, NestJS, SvelteKit, Nuxt cards
8. **CTA** — "Replace .env today." with radial glow
9. **Footer** — 4-column: brand, product, integrations, community + copyright

### Responsive

- All grids collapse to single column on mobile (768px breakpoint)
- Font sizes use `clamp()` for fluid scaling
- Nav links + search hidden on mobile
- Padding adjusts via CSS custom property

## Fumadocs Setup

### Core Structure

```
apps/docs/
├── app/
│   ├── layout.tsx              # Root layout with fumadocs provider
│   ├── (home)/
│   │   └── page.tsx            # Custom homepage
│   └── docs/
│       └── [[...slug]]/
│           └── page.tsx        # Docs catch-all
├── content/docs/
│   └── index.mdx              # Placeholder doc
├── lib/
│   └── source.ts              # Fumadocs source loader
├── public/
│   └── images/                 # Generated hero/card images
├── source.config.ts            # MDX + docs config
├── next.config.mjs             # With fumadocs-mdx plugin
├── tailwind.config.ts          # With fumadocs-ui plugin
├── tsconfig.json
└── package.json
```

### LLM Integration

- Enable `includeProcessedMarkdown` in source.config.ts
- Route handlers for `/llms.txt` and `/llms-full.txt`
- Middleware for `.mdx` content negotiation

## Generated Images

6 Recraft V3 illustrations (already generated):
- Fluid bioluminescent (hero/encryption section)
- Topographic contours (schema section)
- Crystal formation (refinements section)
- Fireflies/particles (multi-env section)
- Aurora prism (frameworks section)
- Neural mesh (LSP section)
- Green sunrise (hero background)

## Out of Scope

- Documentation content (future task)
- Blog setup
- Search integration (Orama — future)
- i18n
