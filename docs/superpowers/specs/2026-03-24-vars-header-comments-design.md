# Contextual Header Comments for Generated .vars Files

## Problem

When `vars init` creates a `.vars` file (either from boilerplate or `.env` migration), the user sees the DSL syntax for the first time with no guidance. Public variables in particular need explanation — users should understand that `public` means plaintext (no encryption) and that they can opt into encryption by removing the keyword.

## Decision

Add a `buildHeaderComment()` function to `init.ts` that generates contextual, surgical multi-line comments at the top of every `.vars` file created during `vars init`. Comments are based on conversion context — only relevant insights appear. Comments scale with file size: small files get a compact form, larger files get more detail.

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
  totalVarCount: number;              // total vars parsed (0 = empty .env)
  detectedPrefixes: string[];         // e.g. ["NEXT_PUBLIC_", "VITE_"]
}

// Exported for unit testing
export function buildHeaderComment(ctx: HeaderCommentContext): string;
```

### Design Principles

1. **Prefix-based, not framework-based.** Say "NEXT_PUBLIC_ variables were marked public" — not "Detected Next.js". The user knows their framework; they need to know the *rule* that was applied.
2. **Short-form for small files.** When `totalVarCount <= 5`, emit a compact comment (core rule + docs link only). Avoids comment-to-content ratio > 1:1.
3. **Outcome over mechanism.** Say "encrypted before commit" not "encrypted when you run `vars hide`". New users don't know what `hide` means yet.
4. **Actionable, not descriptive.** Say "check that public/encrypted classification is correct" not "review the result below".

### Conditional Insights

| Condition | Comment line(s) |
|-----------|-----------------|
| `source === "env"` and `totalVarCount > 0` | `Migrated from .env — check that public/encrypted classification is correct.` |
| `source === "env"` and `totalVarCount === 0` | `No variables found in .env — add your own below.` + boilerplate guidance lines |
| `source === "boilerplate"` | `Replace the example variables below with your own.` + `` `public` = plaintext (not encrypted). Remove it to encrypt a var. `` |
| `detectedPrefixes.length > 0` (long form) | `Variables with <PREFIX_1>, <PREFIX_2> prefixes were marked public.` |
| `publicVarNames.length > 0` and no prefix rule explains them | Names the specific manually-marked public vars. |
| `totalVarCount > 0` and `publicVarNames.length === 0` | `All variables will be encrypted before commit.` |
| Always | `Docs: https://vars-docs.vercel.app/docs/file-format` |

### Short-Form vs Long-Form

When `totalVarCount <= 5`, use the **short form** — just the core insight + docs link:

```
# @vars-state unlocked
#
# `public` = plaintext (not encrypted). Remove it to encrypt a var.
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

When `totalVarCount > 5`, use the **long form** with full contextual insights (examples below).

### Example Outputs

**Next.js + Vite monorepo migration (10+ vars, multiple prefixes):**

```
# @vars-state unlocked
#
# Migrated from .env — check that public/encrypted classification is correct.
# Variables with NEXT_PUBLIC_, VITE_ prefixes were marked public.
#
# `public` vars are plaintext and will not be encrypted. If any of these
# should be secret, remove the `public` keyword to enable encryption.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

**Small Expo migration (4 vars, 2 public):**

```
# @vars-state unlocked
#
# `public` = plaintext (not encrypted). Remove it to encrypt a var.
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

**Boilerplate (no .env found):**

```
# @vars-state unlocked
#
# Replace the example variables below with your own.
# `public` = plaintext (not encrypted). Remove it to encrypt a var.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000
DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
```

Note: the boilerplate template itself gains a secret variable example (`DATABASE_URL`) so the user sees both sides of the public/private model without reading a single comment.

**Migration, no public vars detected (8 vars, all private):**

```
# @vars-state unlocked
#
# Migrated from .env — check that public/encrypted classification is correct.
# All variables will be encrypted before commit.
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
# `public` = plaintext (not encrypted). Remove it to encrypt a var.
#
# Docs: https://vars-docs.vercel.app/docs/file-format
#
env(dev, staging, prod)
```

## Implementation

### Files Modified

- `packages/cli/src/commands/init.ts` — add `buildHeaderComment()`, update boilerplate template and `migrateFromEnv()` to use it

### Changes to `migrateFromEnv`

- Return a richer result (or accept a mutable context) so the caller knows which public vars were detected and which prefixes matched
- The header comment is prepended to the output
- Track `detectedPrefixes` as a `Set<string>` during iteration — when a var matches a prefix, add it

### Changes to boilerplate path

- Replace the hardcoded template string with one that calls `buildHeaderComment({ source: "boilerplate", publicVarNames: [], totalVarCount: 0, detectedPrefixes: [] })`
- Add a `DATABASE_URL` example to the boilerplate so users see a secret variable alongside the public ones

### Prefix-to-Display Mapping

Used for the comment line "Variables with X, Y prefixes were marked public":

```ts
const PUBLIC_PREFIXES = ["NEXT_PUBLIC_", "VITE_", "REACT_APP_", "NUXT_PUBLIC_", "EXPO_PUBLIC_", "GATSBY_"];
```

All detected prefixes are listed in the comment (e.g., "NEXT_PUBLIC_, VITE_"). No framework brand names — just the prefix itself.

### Named Var List

Only shown when public vars exist that are NOT explained by a detected prefix (i.e., manually marked public). For prefix-matched vars, the prefix rule line is sufficient — listing individual names is redundant when the prefix explains the pattern.

## Testing

- Unit test `buildHeaderComment()` for each combination: boilerplate, small migration (<= 5 vars), large migration (> 5 vars), migration with prefixes, migration with multiple prefixes, migration without public vars, empty .env
- Test short-form threshold boundary (5 vars vs 6 vars)
- Snapshot the full output of `migrateFromEnv()` for a sample .env with mixed public/private vars
- Verify boilerplate template includes the secret variable example
