# Fumadocs + Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a Fumadocs documentation site in `apps/docs` with a custom dark-mode homepage featuring generative AI illustrations, proper Shiki syntax highlighting, and shadcn/ui components.

**Architecture:** Next.js 15 + Fumadocs (core/ui/mdx) + Tailwind CSS v4 + shadcn/ui. Homepage is a custom TSX page using shadcn primitives (Button, Card, Badge, Separator). Code blocks use Shiki with a custom green-tinted theme. Generative images from Recraft V3 stored in `public/images/`. LLM integration via fumadocs route handlers.

**Tech Stack:** Next.js 15, React 19, fumadocs-core, fumadocs-ui, fumadocs-mdx, shadcn/ui, Tailwind CSS v4, Shiki, pnpm workspaces, Turborepo

---

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
│   ├── layout.tsx                     # Root: RootProvider, fonts, global.css
│   ├── global.css                     # Tailwind v4 + fumadocs presets
│   ├── (home)/
│   │   ├── layout.tsx                 # HomeLayout wrapper
│   │   └── page.tsx                   # Custom homepage (all sections)
│   ├── docs/
│   │   ├── layout.tsx                 # DocsLayout + sidebar tree
│   │   └── [[...slug]]/
│   │       └── page.tsx               # Docs page (generateStaticParams etc.)
│   ├── api/search/route.ts            # Orama search endpoint
│   ├── llms.txt/route.ts              # LLM index
│   └── llms-full.txt/route.ts         # LLM full text
├── components/
│   ├── mdx.tsx                        # MDX component provider
│   ├── ui/                            # shadcn components (button, card, badge, separator)
│   └── homepage/
│       ├── hero.tsx                    # Hero section
│       ├── ticker.tsx                  # Social proof ticker
│       ├── feature-encryption.tsx      # Full-width encryption feature
│       ├── comparison.tsx              # .env vs .vars (redesigned)
│       ├── bento.tsx                   # Bento grid features
│       ├── frameworks.tsx              # Framework support (redesigned)
│       ├── cta.tsx                     # Bottom CTA
│       ├── footer.tsx                  # Site footer
│       └── code-block.tsx             # Shiki-powered .vars syntax preview
├── lib/
│   ├── source.ts                      # Fumadocs source loader
│   ├── layout.shared.tsx              # Shared nav config
│   ├── fonts.ts                       # Font definitions
│   └── shiki.ts                       # Shiki highlighter with green theme
├── content/docs/
│   ├── index.mdx                      # Getting started placeholder
│   └── meta.json                      # Sidebar ordering
└── public/images/
    ├── hero-bg.webp                   # Green sunrise hero background
    ├── fluid-green.webp               # Bioluminescent fluid
    ├── topographic.webp               # Green contour map
    ├── crystal.webp                   # Crystal formation
    ├── fireflies.webp                 # Particle field
    ├── aurora.webp                    # Aurora prism
    └── neural-mesh.webp              # Neural network sphere
```

Monorepo root changes:
- Modify: `pnpm-workspace.yaml` — add `apps/*`
- Modify: `turbo.json` — add `.next/**` to build outputs
- Modify: `.gitignore` — add `.next/`, `.source/`

---

### Task 1: Monorepo Config + Scaffold

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`
- Modify: `.gitignore`
- Create: `apps/docs/package.json`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/next.config.mjs`
- Create: `apps/docs/postcss.config.mjs`
- Create: `apps/docs/source.config.ts`

- [ ] **Step 1: Update pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Update turbo.json — add .next to build outputs**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 3: Append to .gitignore**

Add these lines:
```
# Next.js
.next/

# Fumadocs MDX generated
.source/

# Superpowers
.superpowers/
```

- [ ] **Step 4: Create apps/docs/package.json**

```json
{
  "name": "@vars/docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fumadocs-core": "^16.0.0",
    "fumadocs-mdx": "^14.0.0",
    "fumadocs-ui": "^16.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "shiki": "^3.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/mdx": "^2.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 5: Create apps/docs/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "collections/*": [".source/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".source/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create apps/docs/next.config.mjs**

```js
import { createMDX } from 'fumadocs-mdx/next';

const config = {
  reactStrictMode: true,
};

const withMDX = createMDX();

export default withMDX(config);
```

- [ ] **Step 7: Create apps/docs/postcss.config.mjs**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 8: Create apps/docs/source.config.ts**

```ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig();
```

- [ ] **Step 9: Run pnpm install from monorepo root**

Run: `cd /Users/srujangurram/.superset/worktrees/vars/docs && pnpm install`

- [ ] **Step 10: Commit**

```bash
git add pnpm-workspace.yaml turbo.json .gitignore apps/docs/package.json apps/docs/tsconfig.json apps/docs/next.config.mjs apps/docs/postcss.config.mjs apps/docs/source.config.ts pnpm-lock.yaml
git commit -m "feat(docs): scaffold fumadocs app with monorepo config"
```

---

### Task 2: Fumadocs Core Files (layout, source, docs page)

**Files:**
- Create: `apps/docs/app/global.css`
- Create: `apps/docs/lib/fonts.ts`
- Create: `apps/docs/lib/source.ts`
- Create: `apps/docs/lib/layout.shared.tsx`
- Create: `apps/docs/components/mdx.tsx`
- Create: `apps/docs/app/layout.tsx`
- Create: `apps/docs/app/docs/layout.tsx`
- Create: `apps/docs/app/docs/[[...slug]]/page.tsx`
- Create: `apps/docs/content/docs/index.mdx`
- Create: `apps/docs/content/docs/meta.json`

- [ ] **Step 1: Create apps/docs/app/global.css**

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';

@source '../node_modules/fumadocs-ui/dist/**/*.js';
@source '../components/**/*.tsx';

:root {
  --color-fd-primary: 142 71% 45%;
  --color-fd-ring: 142 71% 45%;
}

.dark {
  --color-fd-primary: 142 71% 45%;
  --color-fd-ring: 142 71% 45%;
}
```

Note: We set fumadocs primary color to our brand green (#22c55e = hsl 142 71% 45%).

- [ ] **Step 2: Create apps/docs/lib/fonts.ts**

```ts
import { Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';

export const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  style: ['normal', 'italic'],
});
```

- [ ] **Step 3: Create apps/docs/lib/source.ts**

```ts
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

- [ ] **Step 4: Create apps/docs/lib/layout.shared.tsx**

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-sm shadow-green-500/20">
            <span className="font-mono text-[11px] font-bold text-green-50">
              {'{ }'}
            </span>
          </span>
          vars
        </span>
      ),
    },
    githubUrl: 'https://github.com/user/vars',
    links: [
      { text: 'Documentation', url: '/docs' },
    ],
  };
}
```

- [ ] **Step 5: Create apps/docs/components/mdx.tsx**

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
```

- [ ] **Step 6: Create apps/docs/app/layout.tsx**

```tsx
import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { instrumentSans, jetbrainsMono, newsreader } from '@/lib/fonts';

export const metadata = {
  title: {
    template: '%s | vars',
    default: 'vars — Encrypted Environment Variables',
  },
  description:
    'Schema-validated, encrypted, multi-environment variables. One .vars file replaces your entire .env workflow.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{
            defaultTheme: 'dark',
            forcedTheme: 'dark',
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create apps/docs/app/docs/layout.tsx**

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...baseOptions()} tree={source.pageTree}>
      {children}
    </DocsLayout>
  );
}
```

- [ ] **Step 8: Create apps/docs/app/docs/[[...slug]]/page.tsx**

```tsx
import {
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
```

- [ ] **Step 9: Create apps/docs/content/docs/index.mdx**

Create the file with this content (note: the code fences inside use triple backticks — write the file directly, don't copy from this markdown):

Frontmatter:
- title: "Getting Started"
- description: "Get up and running with vars in under 5 minutes."

Body sections:
- "## Installation" with a bash code block: `npx vars init`
- Paragraph: "This creates a `.vars` file in your project root with an empty schema."
- "## Quick Start" with a code block showing a DATABASE_URL variable with @dev and @prod environments
- Paragraph: "Then encrypt it:" with a bash code block: `npx vars lock`

- [ ] **Step 10: Create apps/docs/content/docs/meta.json**

```json
{
  "root": true,
  "pages": ["---Getting Started---", "index"]
}
```

- [ ] **Step 11: Verify docs page works**

Run: `cd apps/docs && pnpm dev`
Expected: Next.js dev server starts, `/docs` shows the getting-started page with fumadocs UI.

- [ ] **Step 12: Commit**

```bash
git add apps/docs/app apps/docs/lib apps/docs/components apps/docs/content
git commit -m "feat(docs): add fumadocs core layout, docs page, and sample content"
```

---

### Task 3: Install shadcn/ui + Download Images

**Files:**
- Create: `apps/docs/components.json`
- Create: `apps/docs/lib/utils.ts`
- Create: `apps/docs/components/ui/button.tsx` (via shadcn CLI)
- Create: `apps/docs/components/ui/card.tsx`
- Create: `apps/docs/components/ui/badge.tsx`
- Create: `apps/docs/components/ui/separator.tsx`
- Create: `apps/docs/public/images/*.webp` (7 images)

- [ ] **Step 1: Initialize shadcn**

Run: `cd apps/docs && pnpm dlx shadcn@latest init -d`

If the CLI asks questions, choose: New York style, Zinc base color, CSS variables.

Then manually ensure `components.json` has `aliases.components` pointing to `@/components/ui` and `aliases.utils` pointing to `@/lib/utils`.

- [ ] **Step 2: Install shadcn components**

Run:
```bash
cd apps/docs
pnpm dlx shadcn@latest add button card badge separator
```

- [ ] **Step 3: Download generated images to public/images/**

Run from `apps/docs`:
```bash
mkdir -p public/images
curl -sL "https://v3b.fal.media/files/b/0a93055b/lEiPsR4gWmbbDYKPE5XXM_image.webp" -o public/images/hero-bg.webp
curl -sL "https://v3b.fal.media/files/b/0a930537/mox7Kp7jlnvC-mKZH9LGc_image.webp" -o public/images/fluid-green.webp
curl -sL "https://v3b.fal.media/files/b/0a930538/3Qs64YuFasabxWhirAaUR_image.webp" -o public/images/topographic.webp
curl -sL "https://v3b.fal.media/files/b/0a930538/ffkKsFsWceeGaxvW8-hfC_image.webp" -o public/images/crystal.webp
curl -sL "https://v3b.fal.media/files/b/0a930538/Zz12pmb9i8etobUfKx7NR_image.webp" -o public/images/fireflies.webp
curl -sL "https://v3b.fal.media/files/b/0a930539/MDh5dWpNSVD19Lt8hCasD_image.webp" -o public/images/aurora.webp
curl -sL "https://v3b.fal.media/files/b/0a930539/F4hMG-Polseg_79IGCz2Z_image.webp" -o public/images/neural-mesh.webp
```

- [ ] **Step 4: Commit**

```bash
git add apps/docs/components.json apps/docs/lib/utils.ts apps/docs/components/ui apps/docs/public/images
git commit -m "feat(docs): add shadcn/ui components and generated hero images"
```

---

### Task 4: Shiki Code Block with Green Editor Theme

**Files:**
- Create: `apps/docs/lib/shiki.ts`
- Create: `apps/docs/components/homepage/code-block.tsx`

- [ ] **Step 1: Create apps/docs/lib/shiki.ts**

Custom green-tinted Monokai theme. Variable names bright, decorators/env tags dimmer, Zod schemas in green, values muted. Mimics a real editor.

```ts
import type { ThemeRegistration } from 'shiki';

export const varsTheme: ThemeRegistration = {
  name: 'vars-green',
  type: 'dark',
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#e8e8e8',
    'editorLineNumber.foreground': '#333333',
    'editorLineNumber.activeForeground': '#22c55e',
  },
  tokenColors: [
    {
      name: 'Comment',
      scope: ['comment'],
      settings: { foreground: '#3a3a3a', fontStyle: 'italic' },
    },
    {
      name: 'Variable name (bright)',
      scope: ['variable', 'entity.name', 'support.variable'],
      settings: { foreground: '#f0fdf4', fontStyle: 'bold' },
    },
    {
      name: 'Schema / type (green)',
      scope: ['entity.name.function', 'support.function', 'keyword.operator'],
      settings: { foreground: '#22c55e' },
    },
    {
      name: 'String',
      scope: ['string'],
      settings: { foreground: '#4ade80' },
    },
    {
      name: 'Number',
      scope: ['constant.numeric'],
      settings: { foreground: '#86efac' },
    },
    {
      name: 'Keyword / decorator (dim)',
      scope: ['keyword', 'storage', 'entity.name.tag'],
      settings: { foreground: '#3b8a5a' },
    },
    {
      name: 'Encrypted value (very dim)',
      scope: ['string.other', 'meta.embedded'],
      settings: { foreground: '#2a2a2a' },
    },
    {
      name: 'Punctuation',
      scope: ['punctuation'],
      settings: { foreground: '#555555' },
    },
  ],
};
```

- [ ] **Step 2: Create apps/docs/components/homepage/code-block.tsx**

Since `.vars` isn't a real language in Shiki, we render styled spans manually to get exact control. This component renders the `.vars` file preview used in the hero and comparison sections.

```tsx
import { cn } from '@/lib/utils';

type Token = { text: string; className: string };
type Line = Token[];

const LINES: Line[] = [
  [
    { text: 'DATABASE_URL', className: 'text-green-50 font-semibold' },
    { text: '  ', className: '' },
    { text: 'z.string().url().startsWith("postgres://")', className: 'text-green-500' },
  ],
  [
    { text: '  @dev', className: 'text-green-700' },
    { text: '  = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:7f3a9b2c...', className: 'text-neutral-700' },
  ],
  [
    { text: '  @prod', className: 'text-green-700' },
    { text: ' = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:e8d1f0a3...', className: 'text-neutral-700' },
  ],
  [],
  [
    { text: 'PORT', className: 'text-green-50 font-semibold' },
    { text: '  ', className: '' },
    { text: 'z.coerce.number().int().min(1024)', className: 'text-green-500' },
  ],
  [
    { text: '  @default', className: 'text-green-700' },
    { text: ' = ', className: 'text-neutral-600' },
    { text: 'enc:v1:aes256gcm:2c4b8e...', className: 'text-neutral-700' },
  ],
  [],
  [
    { text: '// Cross-variable refinement', className: 'text-neutral-700 italic' },
  ],
  [
    { text: '@refine', className: 'text-green-400 font-semibold' },
    { text: ' ', className: '' },
    { text: '(env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true', className: 'text-green-500' },
  ],
  [
    { text: '  "DEBUG must be true when LOG_LEVEL is debug"', className: 'text-green-800' },
  ],
];

export function VarsCodeBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a] shadow-2xl shadow-black/50',
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        <span className="ml-3 font-mono text-xs text-neutral-500">.vars</span>
      </div>
      {/* Code body */}
      <div className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.9]">
        {LINES.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-5 w-5 select-none text-right text-xs text-neutral-700">
              {i + 1}
            </span>
            <span>
              {line.length === 0 ? '\u00A0' : line.map((token, j) => (
                <span key={j} className={token.className}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/docs/lib/shiki.ts apps/docs/components/homepage/code-block.tsx
git commit -m "feat(docs): add Shiki green theme and .vars code block component"
```

---

### Task 5: Homepage — Hero Section

**Files:**
- Create: `apps/docs/components/homepage/hero.tsx`

- [ ] **Step 1: Create hero.tsx**

```tsx
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VarsCodeBlock } from './code-block';

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-16 md:px-10">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.webp"
          alt=""
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_40%,transparent_30%,#050505_75%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex max-w-[800px] flex-col items-center text-center">
        <Badge
          variant="outline"
          className="mb-8 gap-2 border-green-500/15 bg-green-500/[0.08] px-4 py-1.5 font-mono text-xs text-green-500"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px] shadow-green-500" />
          Encrypted by default
        </Badge>

        <h1 className="font-sans text-[clamp(40px,7vw,68px)] font-bold leading-[1.05] tracking-[-3px] text-white">
          Stop leaking secrets
          <br />
          in{' '}
          <em className="font-serif italic text-green-500 font-normal">
            plaintext.
          </em>
        </h1>

        <p className="mt-6 max-w-[520px] text-[clamp(15px,2vw,17px)] leading-relaxed text-white/50">
          vars replaces .env with encrypted, schema-validated, multi-environment
          variables — in a single file your whole team can share.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <Button
            size="lg"
            className="bg-green-500 text-black font-semibold shadow-[0_0_30px] shadow-green-500/30 hover:bg-green-400 hover:shadow-green-500/50"
          >
            Get Started →
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-white/[0.06] bg-white/[0.04] text-white/50 hover:border-green-500/15 hover:text-white"
          >
            npx vars init
          </Button>
        </div>

        <VarsCodeBlock className="mt-14 w-full max-w-[620px]" />
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/components/homepage/hero.tsx
git commit -m "feat(docs): add hero section with generative background and code preview"
```

---

### Task 6: Homepage — Ticker + Encryption Feature

**Files:**
- Create: `apps/docs/components/homepage/ticker.tsx`
- Create: `apps/docs/components/homepage/feature-encryption.tsx`

- [ ] **Step 1: Create ticker.tsx**

```tsx
import { Separator } from '@/components/ui/separator';

const ITEMS = [
  { label: 'AES-256-GCM', bold: true },
  { label: 'Zod', bold: true },
  { label: '6 framework plugins' },
  { label: 'LSP + VS Code' },
  { label: 'AI-safe by design' },
];

export function Ticker() {
  return (
    <div className="border-b border-white/[0.06] px-5 py-7">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {ITEMS.map((item, i) => (
          <span key={i} className="flex items-center gap-6">
            <span className="whitespace-nowrap font-mono text-xs uppercase tracking-widest text-white/25">
              {item.bold ? (
                <strong className="text-white/40">{item.label}</strong>
              ) : (
                item.label
              )}
            </span>
            {i < ITEMS.length - 1 && (
              <Separator orientation="vertical" className="h-3 bg-white/[0.06]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create feature-encryption.tsx**

```tsx
import Image from 'next/image';

export function FeatureEncryption() {
  return (
    <section className="mx-auto grid max-w-[1120px] items-center gap-16 px-5 py-24 md:grid-cols-2 md:px-10">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-[2px] text-green-500">
          Encryption
        </span>
        <h2 className="mt-4 text-4xl font-bold leading-[1.15] tracking-[-1.5px]">
          Every value encrypted.
          <br />
          <em className="font-serif italic text-green-500 font-normal">
            Every time.
          </em>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/50">
          AES-256-GCM per-value encryption with a PIN-protected master key
          stored in your OS keychain. AI coding agents can read your .vars file
          but can never access the actual secrets. Safe to commit. Safe to share.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]">
        <Image
          src="/images/fluid-green.webp"
          alt=""
          width={600}
          height={450}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/[0.06] bg-[#050505]/85 p-4 font-mono text-xs leading-relaxed backdrop-blur-xl">
          <div>
            <span className="font-semibold text-green-50">SECRET</span>{' '}
            <span className="text-green-500">z.string().min(1)</span>
          </div>
          <div>
            <span className="text-green-700">  @prod</span>{' '}
            <span className="text-neutral-700">= enc:v1:aes256gcm:9c2b4f...</span>
          </div>
          <div className="mt-1 text-green-500">✓ Encrypted — PIN required to decrypt</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/docs/components/homepage/ticker.tsx apps/docs/components/homepage/feature-encryption.tsx
git commit -m "feat(docs): add ticker and encryption feature section"
```

---

### Task 7: Homepage — Comparison Section (Redesigned)

The `.env` vs `.vars` comparison. Previous version had crossed-out text that was hard to read. New design: two cards side by side, `.env` card has a red-tinted surface with clearly visible problems listed as bullet items, `.vars` card has green-tinted surface with the code preview.

**Files:**
- Create: `apps/docs/components/homepage/comparison.tsx`

- [ ] **Step 1: Create comparison.tsx**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Comparison() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-24 md:px-10">
      <div className="mb-12 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          The .env file is{' '}
          <em className="font-serif italic text-green-500 font-normal">broken.</em>
        </h2>
        <p className="mt-3 text-[15px] text-white/50">
          Here&apos;s what changes with vars.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* .env — Before */}
        <Card className="border-red-500/10 bg-red-500/[0.03]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/10 font-mono text-xs">
                .env
              </Badge>
              <CardTitle className="text-sm font-medium text-white/40">
                What you&apos;ve been doing
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-black/40 p-4 font-mono text-xs leading-[2]">
              <div className="text-red-400/60">DATABASE_URL=postgres://admin:password123@db.example.com/prod</div>
              <div className="text-red-400/60">PORT=3000</div>
              <div className="text-red-400/60">STRIPE_KEY=sk_live_abc123def456</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                'Plaintext passwords in git',
                'No type safety',
                'No schema validation',
                'Secrets shared via DMs',
                'Env drift across stages',
                'Runtime crashes on typos',
              ].map((problem) => (
                <div key={problem} className="flex items-start gap-2 text-xs text-red-400/50">
                  <span className="mt-0.5 text-red-500/40">✕</span>
                  {problem}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* .vars — After */}
        <Card className="border-green-500/10 bg-green-500/[0.03]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10 font-mono text-xs">
                .vars
              </Badge>
              <CardTitle className="text-sm font-medium text-white/40">
                What it looks like now
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-black/40 p-4 font-mono text-xs leading-[2]">
              <div>
                <span className="font-semibold text-green-50">DATABASE_URL</span>{' '}
                <span className="text-green-500">z.string().url()</span>
              </div>
              <div className="text-neutral-700">  @prod = enc:v1:aes256gcm:...</div>
              <div>
                <span className="font-semibold text-green-50">PORT</span>{' '}
                <span className="text-green-500">z.coerce.number()</span>
              </div>
              <div className="text-neutral-700">  @default = enc:v1:aes256gcm:...</div>
              <div>
                <span className="font-semibold text-green-50">STRIPE_KEY</span>{' '}
                <span className="text-green-500">z.string().startsWith(&quot;sk_&quot;)</span>
              </div>
              <div className="text-neutral-700">  @prod = enc:v1:aes256gcm:...</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                'AES-256-GCM encrypted',
                'Zod type safety',
                'Build-time validation',
                'Safe to commit & share',
                'All envs in one file',
                'AI-safe by design',
              ].map((benefit) => (
                <div key={benefit} className="flex items-start gap-2 text-xs text-green-400/70">
                  <span className="mt-0.5 text-green-500">✓</span>
                  {benefit}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/components/homepage/comparison.tsx
git commit -m "feat(docs): add redesigned .env vs .vars comparison section"
```

---

### Task 8: Homepage — Bento Grid

**Files:**
- Create: `apps/docs/components/homepage/bento.tsx`

- [ ] **Step 1: Create bento.tsx**

```tsx
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

interface BentoItem {
  label: string;
  title: string;
  description: string;
  image: string;
  span: 'wide' | 'narrow' | 'full';
  code?: string[];
}

const ITEMS: BentoItem[] = [
  {
    label: 'Schema-first',
    title: 'Your schema is native Zod',
    description:
      'No proprietary DSL. Write the same Zod expressions you already use. Type errors at build time, not in production at 3am.',
    image: '/images/topographic.webp',
    span: 'wide',
    code: [
      'z.string().url().startsWith("postgres://")',
      'z.coerce.number().int().min(1024).max(65535)',
      'z.enum(["development", "staging", "production"])',
    ],
  },
  {
    label: 'Multi-env',
    title: 'One file, all environments',
    description:
      'dev, staging, prod — all in one .vars file. No more .env.local, .env.production, .env.staging sprawl.',
    image: '/images/fireflies.webp',
    span: 'narrow',
  },
  {
    label: 'CLI',
    title: 'Powerful tooling',
    description:
      'init, unlock, run, check, gen — everything from the command line. Scriptable and CI-friendly.',
    image: '/images/aurora.webp',
    span: 'narrow',
  },
  {
    label: 'Editor Intelligence',
    title: 'LSP + VS Code extension',
    description:
      'Autocomplete, inline validation, hover docs — your .vars file gets first-class editor support through a dedicated language server.',
    image: '/images/neural-mesh.webp',
    span: 'wide',
  },
];

function spanClass(span: BentoItem['span']) {
  switch (span) {
    case 'wide':
      return 'md:col-span-8';
    case 'narrow':
      return 'md:col-span-4';
    case 'full':
      return 'md:col-span-12';
  }
}

export function Bento() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-20 md:px-10">
      <div className="mb-12 text-center">
        <h2 className="text-[clamp(28px,4vw,38px)] font-bold tracking-[-1.5px]">
          Built for teams that{' '}
          <em className="font-serif italic text-green-500 font-normal">ship.</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {ITEMS.map((item) => (
          <Card
            key={item.label}
            className={`group overflow-hidden border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 hover:shadow-[0_0_30px_rgba(34,197,94,0.04)] ${spanClass(item.span)}`}
          >
            <div className="relative h-[200px] overflow-hidden">
              <Image
                src={item.image}
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <CardContent className="p-6">
              <span className="font-mono text-[10px] uppercase tracking-[2px] text-green-500">
                {item.label}
              </span>
              <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.5px]">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                {item.description}
              </p>
              {item.code && (
                <div className="mt-4 rounded-lg bg-black/40 p-4 font-mono text-[11.5px] leading-[1.8] text-green-500">
                  {item.code.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Full-width refinements card */}
        <Card className="group overflow-hidden border-white/[0.06] bg-[#0a0a0a] transition-all hover:border-green-500/15 md:col-span-12">
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[240px] overflow-hidden">
              <Image
                src="/images/crystal.webp"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <CardContent className="flex flex-col justify-center p-8">
              <span className="font-mono text-[10px] uppercase tracking-[2px] text-green-500">
                Refinements
              </span>
              <h3 className="mt-2.5 text-lg font-semibold tracking-[-0.5px]">
                Cross-variable constraints
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                Express relationships between variables. If LOG_LEVEL is &quot;debug&quot;,
                enforce that DEBUG is true. Validated at build time.
              </p>
              <div className="mt-4 rounded-lg bg-black/40 p-4 font-mono text-[11.5px] leading-[1.8]">
                <div>
                  <span className="font-semibold text-green-400">@refine</span>{' '}
                  <span className="text-green-500">(env) =&gt;</span>
                </div>
                <div className="text-green-500">
                  {'  '}env.LOG_LEVEL !== &quot;debug&quot; || env.DEBUG === true
                </div>
                <div className="text-green-800">
                  {'  '}&quot;DEBUG must be true when LOG_LEVEL is debug&quot;
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/components/homepage/bento.tsx
git commit -m "feat(docs): add bento grid feature section"
```

---

### Task 9: Homepage — Frameworks Section (Redesigned)

Previous version was boring icon cards. New design: a horizontal scrollable strip with framework logos on dark cards, each showing a one-liner integration code snippet. More informative, more interesting.

**Files:**
- Create: `apps/docs/components/homepage/frameworks.tsx`

- [ ] **Step 1: Create frameworks.tsx**

```tsx
import { Card, CardContent } from '@/components/ui/card';

const FRAMEWORKS = [
  {
    name: 'Next.js',
    icon: '▲',
    code: 'withVars(nextConfig)',
    color: 'from-white/5 to-white/[0.02]',
  },
  {
    name: 'Vite',
    icon: '⚡',
    code: 'varsPlugin()',
    color: 'from-purple-500/5 to-purple-500/[0.02]',
  },
  {
    name: 'Astro',
    icon: '🚀',
    code: 'varsIntegration()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
  },
  {
    name: 'NestJS',
    icon: '🔴',
    code: '@Inject(VARS)',
    color: 'from-red-500/5 to-red-500/[0.02]',
  },
  {
    name: 'SvelteKit',
    icon: '🟠',
    code: 'varsPlugin()',
    color: 'from-orange-500/5 to-orange-500/[0.02]',
  },
  {
    name: 'Nuxt',
    icon: '💚',
    code: 'varsPlugin()',
    color: 'from-green-500/5 to-green-500/[0.02]',
  },
];

export function Frameworks() {
  return (
    <section className="border-y border-white/[0.06] py-20">
      <div className="mx-auto max-w-[1120px] px-5 md:px-10">
        <div className="mb-10 text-center">
          <h3 className="text-sm font-medium text-white/40">
            One-line integration with your stack
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FRAMEWORKS.map((fw) => (
            <Card
              key={fw.name}
              className={`group border-white/[0.06] bg-gradient-to-b ${fw.color} transition-all hover:border-green-500/15`}
            >
              <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                <span className="text-2xl">{fw.icon}</span>
                <span className="text-sm font-medium text-white/70">
                  {fw.name}
                </span>
                <code className="rounded-md bg-black/30 px-2.5 py-1 font-mono text-[10px] text-green-500/70 transition-colors group-hover:text-green-400">
                  {fw.code}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/docs/components/homepage/frameworks.tsx
git commit -m "feat(docs): add redesigned frameworks section with code snippets"
```

---

### Task 10: Homepage — CTA + Footer

**Files:**
- Create: `apps/docs/components/homepage/cta.tsx`
- Create: `apps/docs/components/homepage/footer.tsx`

- [ ] **Step 1: Create cta.tsx**

```tsx
import { Button } from '@/components/ui/button';

export function CTA() {
  return (
    <section className="relative overflow-hidden px-5 py-28 text-center md:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_60%,rgba(34,197,94,0.06)_0%,transparent_60%)]" />
      <div className="relative">
        <h2 className="text-[clamp(32px,5vw,48px)] font-bold tracking-[-2px]">
          Replace .env{' '}
          <em className="font-serif italic text-green-500 font-normal">today.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-[450px] text-base leading-relaxed text-white/50">
          One command. Five minutes. Never worry about plaintext secrets again.
        </p>
        <Button
          size="lg"
          className="mt-8 bg-green-500 px-10 text-[15px] font-semibold text-black shadow-[0_0_30px] shadow-green-500/30 hover:bg-green-400 hover:shadow-green-500/50"
        >
          Read the Docs →
        </Button>
        <div className="mt-5 font-mono text-sm text-white/25">
          <code className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-4 py-1.5">
            npx vars init
          </code>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create footer.tsx**

```tsx
import { Separator } from '@/components/ui/separator';

const COLUMNS = [
  {
    title: 'Product',
    links: ['Documentation', 'Getting Started', 'CLI Reference', 'Changelog'],
  },
  {
    title: 'Integrations',
    links: ['Next.js', 'Vite', 'Astro', 'NestJS', 'VS Code'],
  },
  {
    title: 'Community',
    links: ['GitHub', 'Discord', 'Twitter / X', 'Contributing'],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1120px] px-5 pb-10 pt-16 md:px-10">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-sm shadow-green-500/20">
                <span className="font-mono text-[11px] font-bold text-green-50">
                  {'{ }'}
                </span>
              </span>
              vars
            </div>
            <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/25">
              Encrypted, typed, schema-first environment variables. The last env
              management tool you&apos;ll ever need.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[13px] text-white/25 transition-colors hover:text-green-500"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-white/[0.06]" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-white/25">
            © 2026 vars. Open source under MIT.
          </span>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-white/25 hover:text-green-500">
              Privacy
            </a>
            <a href="#" className="text-xs text-white/25 hover:text-green-500">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/docs/components/homepage/cta.tsx apps/docs/components/homepage/footer.tsx
git commit -m "feat(docs): add CTA and footer sections"
```

---

### Task 11: Homepage — Assemble + Home Layout

**Files:**
- Create: `apps/docs/app/(home)/layout.tsx`
- Create: `apps/docs/app/(home)/page.tsx`

- [ ] **Step 1: Create apps/docs/app/(home)/layout.tsx**

```tsx
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
```

- [ ] **Step 2: Create apps/docs/app/(home)/page.tsx**

```tsx
import { Hero } from '@/components/homepage/hero';
import { Ticker } from '@/components/homepage/ticker';
import { FeatureEncryption } from '@/components/homepage/feature-encryption';
import { Comparison } from '@/components/homepage/comparison';
import { Bento } from '@/components/homepage/bento';
import { Frameworks } from '@/components/homepage/frameworks';
import { CTA } from '@/components/homepage/cta';
import { Footer } from '@/components/homepage/footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Hero />
      <Ticker />
      <FeatureEncryption />
      <Comparison />
      <Bento />
      <Frameworks />
      <CTA />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Verify the full homepage**

Run: `cd apps/docs && pnpm dev`
Expected: Homepage at `http://localhost:3000` shows all sections. Navigate to `/docs` to verify docs layout works.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/\(home\)
git commit -m "feat(docs): assemble homepage with all sections"
```

---

### Task 12: LLM Integration + Search

**Files:**
- Create: `apps/docs/app/llms.txt/route.ts`
- Create: `apps/docs/app/llms-full.txt/route.ts`
- Create: `apps/docs/app/api/search/route.ts`

- [ ] **Step 1: Create apps/docs/app/llms.txt/route.ts**

```ts
import { generateText, llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const res = llms(source);

  return new Response(res, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

- [ ] **Step 2: Create apps/docs/app/llms-full.txt/route.ts**

```ts
import { generateText, llms } from 'fumadocs-core/source';
import { source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();
  const res = await generateText(pages);

  return new Response(res, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

Note: The exact API may vary by fumadocs-core version. If `llms` or `generateText` are not exported from `fumadocs-core/source`, check the fumadocs docs at `/docs/integrations/llms` for the current API. The pattern is always: use the source loader to generate text for LLM consumption.

- [ ] **Step 3: Create apps/docs/app/api/search/route.ts**

```ts
import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

export const { GET } = createFromSource(source);
```

- [ ] **Step 4: Verify LLM endpoints**

Run: `curl http://localhost:3000/llms.txt`
Expected: Text index of documentation pages.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/app/llms.txt apps/docs/app/llms-full.txt apps/docs/app/api
git commit -m "feat(docs): add LLM integration endpoints and search API"
```

---

### Task 13: Final Verification + Polish

- [ ] **Step 1: Run full build from monorepo root**

Run: `cd /Users/srujangurram/.superset/worktrees/vars/docs && pnpm build`
Expected: All packages build including `apps/docs`.

- [ ] **Step 2: Fix any type errors**

Run: `cd apps/docs && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Test responsive layout**

Open `http://localhost:3000` in browser, resize to mobile width (375px).
Verify: Nav collapses, grids stack to single column, fonts scale down, all sections readable.

- [ ] **Step 4: Test docs navigation**

Navigate to `/docs`. Verify sidebar, search, page content all work.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A apps/docs
git commit -m "fix(docs): polish and fix build issues"
```
