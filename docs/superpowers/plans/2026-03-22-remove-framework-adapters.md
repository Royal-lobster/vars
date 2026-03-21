# Remove Framework Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all framework adapter packages, fix `vars run` to use Zod validation, inline `Redacted` in generated code, and simplify the init flow.

**Architecture:** Framework adapters (`next`, `vite`, `astro`, `nestjs`, `turbo`) are obsolete — `vars run` injects decrypted env vars into `process.env` before the framework starts, and all frameworks natively inline prefixed env vars into client bundles. The `vars run` command needs to use `loadVars()` for Zod schema validation. The codegen output must inline the `Redacted` class instead of importing from `@vars/core`. The init command drops adapter config codemods but keeps `wrapDevScript`.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Turborepo

---

### Task 1: Fix `vars run` to use `loadVars()` for validation

**Files:**
- Modify: `packages/cli/src/commands/run.ts`
- Modify: `packages/cli/src/__tests__/commands/run.test.ts`

- [ ] **Step 1: Update run.test.ts — add validation test**

Add a test that verifies `vars run` rejects invalid values via Zod:

```ts
it("rejects values that fail schema validation", () => {
  writeFileSync(
    join(tmpDir, ".vars"),
    [
      "PORT  z.coerce.number().int().min(1024)",
      "  @default = not-a-number",
    ].join("\n"),
  );

  expect(() => buildRunEnv(join(tmpDir, ".vars"), "dev", key)).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/srujangurram/Developer/Personal/vars && pnpm --filter @vars/cli test -- run.test`
Expected: FAIL — `buildRunEnv` currently does no validation.

- [ ] **Step 3: Rewrite `buildRunEnv` to use `loadVars()`**

Replace the manual parse/decrypt loop in `packages/cli/src/commands/run.ts` with a call to `loadVars()`. The function should call `loadVars()`, then extract raw string values from the `Redacted` wrappers:

```ts
import {
  loadVars,
  extractValue,
  isEncrypted,
} from "@vars/core";
import type { LoadOptions } from "@vars/core";
```

```ts
export function buildRunEnv(
  filePath: string,
  env: string,
  key: Buffer | null,
): Record<string, string | undefined> {
  const options: LoadOptions = { env };
  if (key) options.key = key;

  // loadVars() does: parse → resolve → decrypt → Zod validate → @refine → Redacted wrap
  const validated = loadVars(filePath, options);
  const result: Record<string, string | undefined> = {};

  for (const [name, value] of Object.entries(validated)) {
    if (value === undefined || value === null) continue;
    // extractValue() unwraps Redacted and stringifies numbers/booleans for process.env
    result[name] = extractValue(value);
  }

  return result;
}
```

Remove the now-unused `parse`, `decrypt`, `resolveValue` imports. Keep `isEncrypted` only if `fileHasEncryptedValues` still uses it (it does).

> **Note:** This also gains `@extends` resolution and `@refine` cross-variable validation that the old `buildRunEnv` lacked.

- [ ] **Step 4: Update existing tests for new validation behavior**

The test "omits undefined optional values" should still pass. Update the existing test assertions if the validated output changes shape (e.g., coerced types become strings via `extractValue`).

- [ ] **Step 5: Run all run.test tests to verify they pass**

Run: `cd /Users/srujangurram/Developer/Personal/vars && pnpm --filter @vars/cli test -- run.test`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/__tests__/commands/run.test.ts
git commit -m "fix(cli): use loadVars() in vars run for Zod validation"
```

---

### Task 2: Inline `Redacted` class in generated code

**Files:**
- Modify: `packages/core/src/codegen.ts`
- Modify: `packages/core/src/__tests__/codegen.test.ts` (if exists, otherwise check existing test coverage)

- [ ] **Step 1: Check existing codegen tests**

Run: `find packages/core/src/__tests__ -name "*codegen*" -o -name "*generate*" 2>/dev/null`

If tests exist, read them. If not, add a test that verifies the generated output contains an inline Redacted class and does NOT import from `@vars/core`.

- [ ] **Step 2: Update `generateTypes()` in `packages/core/src/codegen.ts`**

Replace:
```ts
lines.push('import { Redacted } from "@vars/core";');
```

With an inlined `Redacted` class:
```ts
lines.push("const INSPECT = Symbol.for(\"nodejs.util.inspect.custom\");");
lines.push("class Redacted<T> {");
lines.push("  #value: T;");
lines.push("  constructor(value: T) { this.#value = value; }");
lines.push("  unwrap(): T { return this.#value; }");
lines.push("  toString(): string { return \"<redacted>\"; }");
lines.push("  toJSON(): string { return \"<redacted>\"; }");
lines.push("  [INSPECT](): string { return \"<redacted>\"; }");
lines.push("}");
```

Also remove `'import { Redacted } from "@vars/core";'` from the generated output entirely.

- [ ] **Step 3: Run codegen tests**

Run: `cd /Users/srujangurram/Developer/Personal/vars && pnpm --filter @vars/core test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/codegen.ts
git commit -m "refactor(codegen): inline Redacted class in generated output"
```

---

### Task 3: Simplify `detect-framework.ts` and `init.ts` — remove adapter codemods

> **Important:** These two files must be updated together to avoid a broken intermediate state (`init.ts` imports `applyFrameworkConfig` from `detect-framework.ts`).

**Files:**
- Modify: `packages/cli/src/utils/detect-framework.ts`
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Gut `detect-framework.ts`**

Remove:
- The `SNIPPETS` object (all adapter code snippets)
- The `FrameworkInfo.package`, `FrameworkInfo.configFile`, `FrameworkInfo.snippet` fields
- All `apply*Config` functions: `applyNextConfig`, `applyViteConfig`, `applyAstroConfig`, `applyNestConfig`, `applyNuxtConfig`, `applySvelteKitConfig`
- The `applyFrameworkConfig` export

Keep:
- `FrameworkInfo` with just `{ name: string; devCommand: string }`
- `detectFramework()` — still useful to know the framework name for `wrapDevScript`
- `wrapDevScript()` — wraps the `"dev"` script with `vars run --env dev --`
- `readPackageJsonDeps()` helper (used by `detectFramework`)

The simplified `FrameworkInfo`:
```ts
export interface FrameworkInfo {
  name: string;
  devCommand: string;
}
```

Update `detectFramework()` return values to drop `package`, `configFile`, `snippet` fields.

- [ ] **Step 2: Update `init.ts` to match**

In `packages/cli/src/commands/init.ts`:
- Remove `applyFrameworkConfig` import
- Remove the block at lines 222-233 that calls `applyFrameworkConfig` and shows adapter config messages
- Keep the `detectFramework` call and `wrapDevScript` call
- Update summary output to not mention framework config files

The framework detection section (around line 220) should become:
```ts
const framework = detectFramework(cwd);
if (framework) {
  const devWrapped = wrapDevScript(cwd, framework);
  if (devWrapped) {
    summaryLines.push(`${pc.green("✓")} dev script updated — ${pc.cyan("pnpm dev")} now uses ${pc.cyan("vars run")}`);
  }
}
```

- [ ] **Step 3: Run CLI tests**

Run: `cd /Users/srujangurram/Developer/Personal/vars && pnpm --filter @vars/cli test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/utils/detect-framework.ts packages/cli/src/commands/init.ts
git commit -m "refactor(cli): remove adapter codemods from init and detect-framework"
```

---

### Task 4: Clean up `plugin-utils.ts` — remove `resolveVarsFile`

**Files:**
- Modify: `packages/core/src/plugin-utils.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Remove `resolveVarsFile` from `plugin-utils.ts`**

`resolveVarsFile` is only used by adapter packages (now deleted). `extractValue` is still used by the rewritten `buildRunEnv` from Task 1, so keep it. Remove only `resolveVarsFile`.

Remove from `packages/core/src/index.ts` the `resolveVarsFile` export:
```ts
// Before:
export { extractValue, regenerateIfStale, resolveVarsFile } from "./plugin-utils.js";
// After:
export { extractValue, regenerateIfStale } from "./plugin-utils.js";
```

- [ ] **Step 2: Run core tests**

Run: `cd /Users/srujangurram/Developer/Personal/vars && pnpm --filter @vars/core test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/plugin-utils.ts packages/core/src/index.ts
git commit -m "refactor(core): remove resolveVarsFile (adapter-only utility)"
```

---

### Task 5: Delete adapter packages

**Files:**
- Delete: `packages/next/` (entire directory)
- Delete: `packages/vite/` (entire directory)
- Delete: `packages/astro/` (entire directory)
- Delete: `packages/nestjs/` (entire directory)
- Delete: `packages/turbo/` (entire directory)

- [ ] **Step 1: Delete the directories**

```bash
rm -rf packages/next packages/vite packages/astro packages/nestjs packages/turbo
```

- [ ] **Step 2: Run `pnpm install` to update lockfile**

```bash
pnpm install
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All remaining packages (core, cli, lsp, vscode) pass.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS — no remaining code imports from deleted packages.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove framework adapter packages

Adapters (next, vite, astro, nestjs, turbo) are obsolete.
vars run injects env vars into process.env before the framework
starts. All frameworks natively handle prefixed env vars for
client-side bundles (VITE_*, NEXT_PUBLIC_*, etc)."
```

---

### Task 6: Update documentation and docs site

**Files:**
- Check and update: `README.md`
- Check and update: `docs/` markdown files
- Modify: `apps/docs/components/homepage/frameworks.tsx` — currently shows adapter code snippets
- Check and update: `apps/docs/content/docs/frameworks/` — individual framework MDX pages (`nextjs.mdx`, `vite.mdx`, `astro.mdx`, `nestjs.mdx`)

- [ ] **Step 1: Search for all adapter references across the repo**

Search in `docs/`, `apps/docs/`, and `README.md` for any references to `@vars/next`, `@vars/vite`, `@vars/astro`, `@vars/nestjs`, `@vars/turbo`, `withVars`, `varsPlugin`, `varsIntegration`, `VarsModule`.

- [ ] **Step 2: Update `apps/docs/components/homepage/frameworks.tsx`**

Replace the adapter code snippets with `vars run` examples for each framework. Each card should show:
```bash
# package.json "dev" script
"dev": "vars run --env dev -- next dev"
```

Or remove the frameworks section entirely if showing framework-specific snippets no longer makes sense.

- [ ] **Step 3: Update or remove framework MDX pages**

The pages at `apps/docs/content/docs/frameworks/` (`nextjs.mdx`, `vite.mdx`, `astro.mdx`, `nestjs.mdx`) document adapter setup. Replace content with `vars run` integration, or consolidate into a single "Framework Integration" page explaining the universal `vars run` approach.

- [ ] **Step 4: Update `README.md`**

Remove any adapter package references. Document the `vars run` workflow:

```bash
# Development
vars run --env dev -- npm run dev

# CI/CD
export VARS_KEY="<base64-master-key>"
vars run --env production -- npm run build
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/ apps/docs/
git commit -m "docs: remove adapter references, document vars run workflow"
```
