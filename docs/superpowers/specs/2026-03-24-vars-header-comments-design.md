# Contextual Header Comments for Generated .vars Files

## Problem

When `vars init` creates a `.vars` file (either from boilerplate or `.env` migration), the user sees the DSL syntax for the first time with no guidance. Public variables in particular need explanation — users should understand that `public` means plaintext (no encryption) and that they can opt into encryption by removing the keyword.

## Decision

Add a `buildHeaderComment()` function to `init.ts` that generates contextual, surgical multi-line comments at the top of every `.vars` file created during `vars init`. Comments are based on conversion context — only relevant insights appear.

## Scope

- **In scope:** `vars init` boilerplate path, `vars init` `.env` migration path
- **Out of scope:** `vars add`, `vars remove`, `vars show/hide`, codegen — these don't generate new `.vars` files from scratch

## Comment Placement

After the `# @vars-state` machine-readable marker, before the `env()` declaration:

```
# @vars-state unlocked
#
# <contextual insights>
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

The `# @vars-state` line stays at line 1. Specifically, `hook.ts` uses `head -1` to check this line — it is the only positionally-dependent consumer. (`ls.ts` and `doctor.ts` use `.includes()` and are position-independent.)

## Context-Aware Comment Builder

### Interface

```ts
interface HeaderCommentContext {
  source: "env" | "boilerplate";
  publicVarNames: string[];
  totalVarCount: number;           // total vars parsed (0 = empty .env)
  framework?: "next" | "vite" | "react" | "nuxt" | "expo" | "gatsby";
}

// Exported for unit testing
export function buildHeaderComment(ctx: HeaderCommentContext): string;
```

### Conditional Insights

| Condition | Comment line(s) |
|-----------|-----------------|
| `source === "env"` and `totalVarCount > 0` | `Migrated from .env — review the result below.` |
| `source === "env"` and `totalVarCount === 0` | `No variables found in .env — add your own below.` + boilerplate guidance lines |
| `source === "boilerplate"` | `Replace the example variables below with your own.` + `Prefix with 'public' for values safe to commit as plaintext.` + `All other variables are encrypted when you run 'vars hide'.` |
| `publicVarNames.length > 0` | Names the specific vars, explains they won't be encrypted, tells user to remove `public` for encryption. |
| `framework` detected | `Detected <Framework> — <PREFIX>_ variables were marked public.` |
| Always | `Docs: https://vars-docs.vercel.app/docs/file-format` |

### Example Outputs

**Next.js .env migration with public vars:**

```
# @vars-state unlocked
#
# Migrated from .env — review the result below.
# Detected Next.js — NEXT_PUBLIC_ variables were marked public.
#
# Public variables (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_NAME) are stored
# as plaintext and will not be encrypted. If any of these should be
# secret, remove the `public` keyword to enable encryption.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

**Boilerplate (no .env found):**

```
# @vars-state unlocked
#
# Replace the example variables below with your own.
# Prefix with `public` for values safe to commit as plaintext.
# All other variables are encrypted when you run `vars hide`.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

**.env migration, no public vars detected:**

```
# @vars-state unlocked
#
# Migrated from .env — review the result below.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

**Empty .env (exists but no parseable variables):**

```
# @vars-state unlocked
#
# No variables found in .env — add your own below.
# Prefix with `public` for values safe to commit as plaintext.
# All other variables are encrypted when you run `vars hide`.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

When `source === "env"` but `publicVarNames` is empty and no variables were parsed at all, fall back to a hybrid message that acknowledges the .env but guides like boilerplate.

**Many public vars (>5):**

When more than 5 public variable names would be listed, truncate:

```
# Public variables (NEXT_PUBLIC_A, NEXT_PUBLIC_B, NEXT_PUBLIC_C,
# NEXT_PUBLIC_D, NEXT_PUBLIC_E, and 3 more) are stored as plaintext...
```

## Implementation

### Files Modified

- `packages/cli/src/commands/init.ts` — add `buildHeaderComment()`, update boilerplate template and `migrateFromEnv()` to use it

### Changes to `migrateFromEnv`

- Return a richer result (or accept a mutable context) so the caller knows which public vars were detected and which framework prefix matched
- The header comment is prepended to the output

### Changes to boilerplate path

- Replace the hardcoded template string with one that calls `buildHeaderComment({ source: "boilerplate", publicVarNames: [] })`

### Framework Detection

Reuse the existing `PUBLIC_PREFIXES` array. Map prefix to framework name:

```ts
const FRAMEWORK_MAP: Record<string, string> = {
  "NEXT_PUBLIC_": "next",
  "VITE_": "vite",
  "REACT_APP_": "react",
  "NUXT_PUBLIC_": "nuxt",
  "EXPO_PUBLIC_": "expo",
  "GATSBY_": "gatsby",
};
```

If multiple framework prefixes are detected, pick the first one encountered while iterating the .env lines (most intuitive to the user — matches what they see first in their file).

## Testing

- Unit test `buildHeaderComment()` for each combination: boilerplate, migration with public vars, migration without public vars, migration with framework detection
- Snapshot the full output of `migrateFromEnv()` for a sample .env with mixed public/private vars
