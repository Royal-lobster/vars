# Contextual Header Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-aware header comments to `.vars` files generated during `vars init`, teaching new users the public/encrypted model with surgical, scaled insights.

**Architecture:** A single exported `buildHeaderComment()` function in `init.ts` takes a context object and returns a comment block string. `migrateFromEnv()` returns richer metadata (detected prefixes, public var names, total count) so the caller can build the context. Short-form for <= 5 vars, long-form for > 5.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-vars-header-comments-design.md`

---

### Task 1: Add `buildHeaderComment()` with boilerplate path

**Files:**
- Create: `packages/cli/src/__tests__/build-header-comment.test.ts`
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Write the failing test for boilerplate comment**

```typescript
import { describe, it, expect } from "vitest";
import { buildHeaderComment } from "../commands/init.js";

describe("buildHeaderComment", () => {
  it("generates boilerplate comment with docs link", () => {
    const result = buildHeaderComment({
      source: "boilerplate",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    expect(result).toContain("Replace the example variables below with your own.");
    expect(result).toContain("`public` = plaintext (not encrypted). Remove it to encrypt a var.");
    expect(result).toContain("Docs: https://vars-docs.vercel.app/docs/file-format");
    expect(result.startsWith("#\n")).toBe(true);
    expect(result.endsWith("\n#")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: FAIL — `buildHeaderComment` is not exported from `init.ts`

- [ ] **Step 3: Implement `buildHeaderComment` with boilerplate path**

Add to `packages/cli/src/commands/init.ts` before the `defineCommand` call:

```typescript
export interface HeaderCommentContext {
  source: "env" | "boilerplate";
  publicVarNames: string[];
  totalVarCount: number;
  detectedPrefixes: string[];
}

export function buildHeaderComment(ctx: HeaderCommentContext): string {
  const lines: string[] = ["#"];

  if (ctx.source === "boilerplate") {
    lines.push("# Replace the example variables below with your own.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  }

  lines.push("#");
  lines.push("# Docs: https://vars-docs.vercel.app/docs/file-format");
  lines.push("#");

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/__tests__/build-header-comment.test.ts
git commit -m "feat: add buildHeaderComment with boilerplate path"
```

---

### Task 2: Add migration paths (short-form and long-form)

**Files:**
- Modify: `packages/cli/src/__tests__/build-header-comment.test.ts`
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Write failing tests for all migration variants**

Append to the existing `describe("buildHeaderComment")` block:

```typescript
  it("generates short-form for small migration (<= 5 vars)", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["NEXT_PUBLIC_API_URL"],
      totalVarCount: 3,
      detectedPrefixes: ["NEXT_PUBLIC_"],
    });

    expect(result).toContain("`public` = plaintext (not encrypted). Remove it to encrypt a var.");
    expect(result).toContain("Docs:");
    // Short form should NOT contain the verbose migration line
    expect(result).not.toContain("Migrated from .env");
    expect(result).not.toContain("Variables with");
  });

  it("generates long-form for large migration (> 5 vars) with prefixes", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["NEXT_PUBLIC_A", "NEXT_PUBLIC_B", "VITE_C"],
      totalVarCount: 10,
      detectedPrefixes: ["NEXT_PUBLIC_", "VITE_"],
    });

    expect(result).toContain("Migrated from .env");
    expect(result).toContain("check that public/encrypted classification is correct");
    expect(result).toContain("Variables with NEXT_PUBLIC_, VITE_ prefixes were marked public.");
    expect(result).toContain("`public` vars are plaintext and will not be encrypted.");
    expect(result).toContain("remove the `public` keyword to enable encryption");
  });

  it("generates long-form for all-private migration (> 5 vars, no public)", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: [],
      totalVarCount: 8,
      detectedPrefixes: [],
    });

    expect(result).toContain("Migrated from .env");
    expect(result).toContain("All variables will be encrypted before commit.");
    expect(result).not.toContain("public");
  });

  it("generates empty-env fallback", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    expect(result).toContain("No variables found in .env");
    expect(result).toContain("add your own below");
    expect(result).toContain("`public` = plaintext (not encrypted).");
  });

  it("generates long-form naming manually-public vars when no prefix matches", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["MY_CUSTOM_VAR", "ANOTHER_VAR"],
      totalVarCount: 8,
      detectedPrefixes: [],
    });

    expect(result).toContain("MY_CUSTOM_VAR, ANOTHER_VAR");
    expect(result).toContain("plaintext and will not be encrypted");
  });

  it("truncates manually-public var names beyond 5", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["A", "B", "C", "D", "E", "F", "G"],
      totalVarCount: 10,
      detectedPrefixes: [],
    });

    expect(result).toContain("A, B, C, D, E, and 2 more");
    expect(result).not.toContain("F");
    expect(result).not.toContain("G");
  });

  it("boundary: 5 vars uses short-form, 6 vars uses long-form", () => {
    const shortCtx = {
      source: "env" as const,
      publicVarNames: ["A"],
      totalVarCount: 5,
      detectedPrefixes: ["NEXT_PUBLIC_"],
    };
    const longCtx = { ...shortCtx, totalVarCount: 6 };

    expect(buildHeaderComment(shortCtx)).not.toContain("Migrated from .env");
    expect(buildHeaderComment(longCtx)).toContain("Migrated from .env");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: FAIL — migration paths not implemented yet

- [ ] **Step 3: Implement all migration paths in `buildHeaderComment`**

Replace the function body in `packages/cli/src/commands/init.ts`:

```typescript
export function buildHeaderComment(ctx: HeaderCommentContext): string {
  const lines: string[] = ["#"];
  const isShortForm = ctx.source === "env" && ctx.totalVarCount > 0 && ctx.totalVarCount <= 5;

  if (ctx.source === "boilerplate") {
    lines.push("# Replace the example variables below with your own.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (ctx.source === "env" && ctx.totalVarCount === 0) {
    lines.push("# No variables found in .env — add your own below.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (isShortForm) {
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else {
    // Long-form migration (> 5 vars)
    lines.push("# Migrated from .env — check that public/encrypted classification is correct.");

    if (ctx.detectedPrefixes.length > 0) {
      lines.push(`# Variables with ${ctx.detectedPrefixes.join(", ")} prefixes were marked public.`);
      lines.push("#");
      lines.push("# `public` vars are plaintext and will not be encrypted. If any of these");
      lines.push("# should be secret, remove the `public` keyword to enable encryption.");
    } else if (ctx.publicVarNames.length > 0) {
      const names = ctx.publicVarNames.length <= 5
        ? ctx.publicVarNames.join(", ")
        : ctx.publicVarNames.slice(0, 5).join(", ") + `, and ${ctx.publicVarNames.length - 5} more`;
      lines.push("#");
      lines.push(`# Public variables (${names}) are plaintext and will not be encrypted.`);
      lines.push("# If any of these should be secret, remove the `public` keyword to enable encryption.");
    } else {
      lines.push("# All variables will be encrypted before commit.");
    }
  }

  lines.push("#");
  lines.push("# Docs: https://vars-docs.vercel.app/docs/file-format");
  lines.push("#");

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/__tests__/build-header-comment.test.ts
git commit -m "feat: add migration paths to buildHeaderComment (short/long form)"
```

---

### Task 3: Update `migrateFromEnv` to return rich context

**Files:**
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Write failing test for `migrateFromEnv` with header comment**

Append to `packages/cli/src/__tests__/build-header-comment.test.ts`:

```typescript
import { migrateFromEnv } from "../commands/init.js";

describe("migrateFromEnv", () => {
  it("includes header comment in migration output", () => {
    const env = `NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_APP_NAME=my-app
DATABASE_URL=postgres://localhost/mydb
SECRET_KEY=abc123
REDIS_URL=redis://localhost
LOG_LEVEL=debug`;

    const result = migrateFromEnv(env);

    // Should have header comment
    expect(result).toContain("Migrated from .env");
    expect(result).toContain("NEXT_PUBLIC_ prefixes were marked public");
    expect(result).toContain("Docs: https://vars-docs.vercel.app/docs/file-format");

    // Should still have the vars
    expect(result).toContain('public NEXT_PUBLIC_API_URL = "https://api.example.com"');
    expect(result).toContain('DATABASE_URL = "postgres://localhost/mydb"');

    // State header is still line 1
    expect(result.startsWith("# @vars-state unlocked\n")).toBe(true);
  });

  it("uses short-form for small .env", () => {
    const env = `API_URL=https://api.example.com
SECRET=abc`;

    const result = migrateFromEnv(env);

    expect(result).not.toContain("Migrated from .env");
    expect(result).toContain("`public` = plaintext");
    expect(result).toContain("Docs:");
  });

  it("detects multiple prefixes", () => {
    const env = `NEXT_PUBLIC_A=1
NEXT_PUBLIC_B=2
VITE_C=3
DB_URL=x
KEY_1=y
KEY_2=z`;

    const result = migrateFromEnv(env);

    expect(result).toContain("NEXT_PUBLIC_, VITE_");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: FAIL — `migrateFromEnv` is not exported and doesn't include header comments

- [ ] **Step 3: Refactor `migrateFromEnv` to track context and prepend header**

In `packages/cli/src/commands/init.ts`, update `migrateFromEnv`:

1. Export the function: `export function migrateFromEnv(...)`
2. Track `detectedPrefixes` as a `Set<string>` and `publicVarNames` as `string[]` during the loop
3. After building the var lines, construct the `HeaderCommentContext` and call `buildHeaderComment()`
4. Insert the header comment between the state line and `env()` declaration

```typescript
const PUBLIC_PREFIXES = ["NEXT_PUBLIC_", "VITE_", "REACT_APP_", "NUXT_PUBLIC_", "EXPO_PUBLIC_", "GATSBY_"];

export function migrateFromEnv(envContent: string): string {
  const detectedPrefixes = new Set<string>();
  const publicVarNames: string[] = [];
  const varLines: string[] = [];

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      console.warn(pc.yellow(`  Skipping invalid variable name: ${key}`));
      continue;
    }
    let value = trimmed.slice(eqIdx + 1).trim();
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    }
    let wasQuoted = false;
    if (value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
         (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
      wasQuoted = true;
    }

    const matchedPrefix = PUBLIC_PREFIXES.find(p => key.startsWith(p));
    const isPublic = !!matchedPrefix;
    if (matchedPrefix) detectedPrefixes.add(matchedPrefix);
    if (isPublic) publicVarNames.push(key);

    const pub = isPublic ? "public " : "";
    if (!wasQuoted && /^\d+$/.test(value)) {
      varLines.push(`${pub}${key} : z.number() = ${value}`);
    } else if (!wasQuoted && (value === "true" || value === "false")) {
      varLines.push(`${pub}${key} : z.boolean() = ${value}`);
    } else {
      varLines.push(`${pub}${key} = "${value}"`);
    }
  }

  const header = buildHeaderComment({
    source: "env",
    publicVarNames,
    totalVarCount: varLines.length,
    detectedPrefixes: [...detectedPrefixes],
  });

  const lines = [
    "# @vars-state unlocked",
    header,
    "env(dev, staging, prod)",
    "",
    ...varLines,
  ];

  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/__tests__/build-header-comment.test.ts
git commit -m "feat: migrateFromEnv tracks prefixes and prepends header comment"
```

---

### Task 4: Update boilerplate template with header and secret example

**Files:**
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/__tests__/build-header-comment.test.ts`

- [ ] **Step 1: Write failing test for boilerplate template output**

Append to the test file:

```typescript
describe("boilerplate template", () => {
  it("includes header comment and secret variable example", () => {
    // Simulate what init.ts builds for the boilerplate path
    const header = buildHeaderComment({
      source: "boilerplate",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    const content = `# @vars-state unlocked
${header}
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000
DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
`;

    expect(content).toContain("Replace the example variables");
    expect(content).toContain("Docs:");
    expect(content).toContain('DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"');
    // State header is line 1
    expect(content.startsWith("# @vars-state unlocked\n")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (this tests the assembled string, not init logic)

Run: `cd packages/cli && pnpm test -- --run build-header-comment`
Expected: PASS (since `buildHeaderComment` already handles boilerplate)

- [ ] **Step 3: Update the boilerplate template in `init.ts`**

In `packages/cli/src/commands/init.ts`, replace the hardcoded content string at lines 59-65:

```typescript
const header = buildHeaderComment({
  source: "boilerplate",
  publicVarNames: [],
  totalVarCount: 0,
  detectedPrefixes: [],
});
content = `# @vars-state unlocked
${header}
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000
DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
`;
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/cli && pnpm test -- --run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/__tests__/build-header-comment.test.ts
git commit -m "feat: update boilerplate template with header comment and secret example"
```

---

### Task 5: Final integration test and cleanup

**Files:**
- Modify: `packages/cli/src/__tests__/build-header-comment.test.ts`

- [ ] **Step 1: Add snapshot tests for full outputs**

Append to the test file:

```typescript
describe("full output snapshots", () => {
  it("snapshot: large Next.js + Vite migration", () => {
    const env = [
      "NEXT_PUBLIC_API_URL=https://api.example.com",
      "NEXT_PUBLIC_APP_NAME=my-app",
      "NEXT_PUBLIC_SENTRY_DSN=https://sentry.io/123",
      "VITE_ADMIN_URL=https://admin.example.com",
      "DATABASE_URL=postgres://localhost/mydb",
      "SECRET_KEY=abc123",
      "REDIS_URL=redis://localhost",
      "SMTP_HOST=smtp.example.com",
    ].join("\n");

    expect(migrateFromEnv(env)).toMatchSnapshot();
  });

  it("snapshot: small Expo migration", () => {
    const env = [
      "EXPO_PUBLIC_API_URL=https://api.example.com",
      "EXPO_PUBLIC_SENTRY_DSN=https://sentry.io/123",
      "API_SECRET=abc",
    ].join("\n");

    expect(migrateFromEnv(env)).toMatchSnapshot();
  });

  it("snapshot: all-private migration", () => {
    const env = [
      "DATABASE_URL=postgres://localhost/mydb",
      "SECRET_KEY=abc123",
      "REDIS_URL=redis://localhost",
      "SMTP_HOST=smtp.example.com",
      "SMTP_USER=user",
      "SMTP_PASS=pass",
      "AWS_KEY=key",
      "AWS_SECRET=secret",
    ].join("\n");

    expect(migrateFromEnv(env)).toMatchSnapshot();
  });

  it("snapshot: boilerplate", () => {
    const header = buildHeaderComment({
      source: "boilerplate",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    expect(header).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run tests to generate snapshots**

Run: `cd packages/cli && pnpm test -- --run build-header-comment --update`
Expected: PASS — snapshots created

- [ ] **Step 3: Review generated snapshots visually**

Run: `cat packages/cli/src/__tests__/__snapshots__/build-header-comment.test.ts.snap`

Verify each snapshot looks correct per the spec examples.

- [ ] **Step 4: Run full test suite**

Run: `cd packages/cli && pnpm test -- --run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/__tests__/
git commit -m "test: add snapshot tests for header comment outputs"
```

---

### Task 6: Run typecheck and full workspace validation

**Files:** None modified — validation only.

- [ ] **Step 1: Run typecheck**

Run: `cd packages/cli && pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm -r test -- --run`
Expected: ALL PASS

- [ ] **Step 3: Final commit (if any lint/type fixes needed)**

Only if steps 1-2 surfaced issues that need fixing.
