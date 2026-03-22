# Unlocked File Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change show/hide from in-place encryption toggle to a file rename pattern (`config.vars` ↔ `config.unlocked.vars`) with `*.unlocked.vars` gitignored as a structural safety layer.

**Architecture:** The rename logic lives in `@vars/node` (show-hide.ts). File resolution helpers in `packages/cli/src/utils/context.ts` and `packages/node/src/use-resolver.ts` are updated to find whichever file variant exists. CLI commands are thin wrappers. VS Code extension switches to filename-based `when` clauses.

**Tech Stack:** TypeScript, Node.js fs (renameSync), citty CLI, VS Code extension API

**Spec:** `docs/superpowers/specs/2026-03-23-unlocked-file-rename-design.md`

---

### Task 1: Add unlocked path helper to `@vars/node`

**Files:**
- Create: `packages/node/src/unlocked-path.ts`
- Modify: `packages/node/src/index.ts`

- [ ] **Step 1: Create the helper module**

```typescript
// packages/node/src/unlocked-path.ts

/** Convert a canonical .vars path to its .unlocked.vars counterpart */
export function toUnlockedPath(filePath: string): string {
  return filePath.replace(/\.vars$/, ".unlocked.vars");
}

/** Convert an .unlocked.vars path back to the canonical .vars path */
export function toLockedPath(filePath: string): string {
  return filePath.replace(/\.unlocked\.vars$/, ".vars");
}

/** Check if a path is an unlocked variant */
export function isUnlockedPath(filePath: string): boolean {
  return filePath.endsWith(".unlocked.vars");
}

/** Normalize any .vars path to its canonical (locked) form */
export function toCanonicalPath(filePath: string): string {
  return isUnlockedPath(filePath) ? toLockedPath(filePath) : filePath;
}
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/node/src/index.ts`:
```typescript
export { toUnlockedPath, toLockedPath, isUnlockedPath, toCanonicalPath } from "./unlocked-path.js";
```

- [ ] **Step 3: Write tests for helpers**

Create `packages/node/src/__tests__/unlocked-path.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toUnlockedPath, toLockedPath, isUnlockedPath, toCanonicalPath } from "../unlocked-path.js";

describe("unlocked-path", () => {
  it("toUnlockedPath converts .vars to .unlocked.vars", () => {
    expect(toUnlockedPath("/project/config.vars")).toBe("/project/config.unlocked.vars");
    expect(toUnlockedPath("vars.vars")).toBe("vars.unlocked.vars");
  });

  it("toLockedPath converts .unlocked.vars to .vars", () => {
    expect(toLockedPath("/project/config.unlocked.vars")).toBe("/project/config.vars");
  });

  it("isUnlockedPath detects unlocked paths", () => {
    expect(isUnlockedPath("config.unlocked.vars")).toBe(true);
    expect(isUnlockedPath("config.vars")).toBe(false);
  });

  it("toCanonicalPath normalizes both variants", () => {
    expect(toCanonicalPath("config.unlocked.vars")).toBe("config.vars");
    expect(toCanonicalPath("config.vars")).toBe("config.vars");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @vars/node test`
Expected: All tests PASS including new unlocked-path tests

- [ ] **Step 5: Commit**

```bash
git add packages/node/src/unlocked-path.ts packages/node/src/index.ts packages/node/src/__tests__/unlocked-path.test.ts
git commit -m "feat(node): add unlocked path helper utilities with tests"
```

---

### Task 2: Update `showFile` to rename then decrypt

**Files:**
- Modify: `packages/node/src/show-hide.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/node/src/__tests__/show-hide.test.ts`:

```typescript
import { existsSync } from "node:fs";

it("show renames .vars to .unlocked.vars and decrypts", () => {
  const content = `# @vars-state locked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
  const locked = join(dir, "config.vars");
  const unlocked = join(dir, "config.unlocked.vars");
  writeFileSync(locked, content);
  hideFile(locked, key);
  showFile(locked, key);

  expect(existsSync(locked)).toBe(false);
  expect(existsSync(unlocked)).toBe(true);
  const result = readFileSync(unlocked, "utf8");
  expect(result).toContain("# @vars-state unlocked");
  expect(result).toContain("my-secret");
});

it("show is idempotent — re-running on .unlocked.vars re-decrypts", () => {
  const content = `# @vars-state locked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
  const locked = join(dir, "config.vars");
  const unlocked = join(dir, "config.unlocked.vars");
  writeFileSync(locked, content);
  hideFile(locked, key);
  // Simulate crash: rename but don't decrypt
  renameSync(locked, unlocked);
  // Re-run show — should detect .unlocked.vars and re-decrypt
  showFile(unlocked, key);
  const result = readFileSync(unlocked, "utf8");
  expect(result).toContain("# @vars-state unlocked");
  expect(result).toContain("my-secret");
});
```

Add `renameSync` to the import from `node:fs`:
```typescript
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, renameSync } from "node:fs";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vars/node test`
Expected: 2 new tests FAIL (showFile doesn't rename yet)

- [ ] **Step 3: Update showFile implementation**

Replace `showFile` in `packages/node/src/show-hide.ts`:

```typescript
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { parse, isEncrypted } from "@vars/core";
import { encryptDeterministic, decrypt } from "./crypto.js";
import { toUnlockedPath, isUnlockedPath } from "./unlocked-path.js";

const STATE_LOCKED = "# @vars-state locked";
const STATE_UNLOCKED = "# @vars-state unlocked";

export function showFile(filePath: string, key: Buffer): string {
  const unlockedPath = isUnlockedPath(filePath) ? filePath : toUnlockedPath(filePath);

  // Rename to .unlocked.vars if not already there
  if (!isUnlockedPath(filePath) && existsSync(filePath)) {
    renameSync(filePath, unlockedPath);
  }

  const content = readFileSync(unlockedPath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() === STATE_LOCKED) {
      result.push(STATE_UNLOCKED);
      continue;
    }
    const match = line.match(/^(\s*\w[\w-]*\s*=\s*)(enc:v2:\S+)(.*)$/);
    if (match) {
      const [, prefix, encrypted, suffix] = match;
      const decrypted = decrypt(encrypted, key);
      const escaped = decrypted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      result.push(`${prefix}"${escaped}"${suffix}`);
      continue;
    }
    result.push(line);
  }

  writeFileSync(unlockedPath, result.join("\n"));
  return unlockedPath;
}
```

Note: `showFile` now returns the path of the written file (the unlocked path). This helps the CLI print the correct path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vars/node test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/node/src/show-hide.ts packages/node/src/__tests__/show-hide.test.ts
git commit -m "feat(node): showFile renames to .unlocked.vars before decrypting"
```

---

### Task 3: Update `hideFile` to encrypt then rename

**Files:**
- Modify: `packages/node/src/show-hide.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/node/src/__tests__/show-hide.test.ts`:

```typescript
it("hide renames .unlocked.vars back to .vars after encrypting", () => {
  const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
  const unlocked = join(dir, "config.unlocked.vars");
  const locked = join(dir, "config.vars");
  writeFileSync(unlocked, content);
  hideFile(unlocked, key);

  expect(existsSync(unlocked)).toBe(false);
  expect(existsSync(locked)).toBe(true);
  const result = readFileSync(locked, "utf8");
  expect(result).toContain("# @vars-state locked");
  expect(result).toContain("enc:v2:aes256gcm-det:");
  expect(result).not.toContain("my-secret");
});

it("hide is idempotent — already-encrypted values are not double-encrypted", () => {
  const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
  const unlocked = join(dir, "config.unlocked.vars");
  writeFileSync(unlocked, content);
  hideFile(unlocked, key);
  const locked = join(dir, "config.vars");
  const first = readFileSync(locked, "utf8");

  // Unlock again, then hide again
  showFile(locked, key);
  hideFile(join(dir, "config.unlocked.vars"), key);
  const second = readFileSync(locked, "utf8");
  expect(first).toBe(second);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vars/node test`
Expected: 2 new tests FAIL

- [ ] **Step 3: Update hideFile implementation**

Replace `hideFile` in `packages/node/src/show-hide.ts`:

```typescript
export function hideFile(filePath: string, key: Buffer): string {
  const lockedPath = isUnlockedPath(filePath) ? toLockedPath(filePath) : filePath;
  const readPath = filePath;

  const content = readFileSync(readPath, "utf8");
  const parsed = parse(content, readPath);
  const publicVars = new Set<string>();

  for (const decl of parsed.ast.declarations) {
    if (decl.kind === "variable" && decl.public) publicVars.add(decl.name);
    if (decl.kind === "group") {
      for (const v of decl.declarations) {
        if (v.public) publicVars.add(v.name);
      }
    }
  }

  const lines = content.split("\n");
  const result: string[] = [];
  let currentVar: string | null = null;
  let currentIsPublic = false;
  let currentGroup: string | null = null;

  for (const line of lines) {
    if (line.trim() === STATE_UNLOCKED) {
      result.push(STATE_LOCKED);
      continue;
    }

    const groupMatch = line.match(/^group\s+(\w+)\s*\{/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
    }

    if (currentGroup && line.trim() === "}" && !line.match(/^\s{2,}/)) {
      currentGroup = null;
    }

    const varMatch = line.match(/^\s*(?:public\s+)?([A-Z][A-Z0-9_]*)\s*[:{=]/);
    if (varMatch) {
      currentVar = varMatch[1];
      currentIsPublic = line.trimStart().startsWith("public") || publicVars.has(currentVar);
    }

    const envMatch = line.match(/^(\s*\w[\w-]*\s*=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/);
    if (envMatch && !currentIsPublic) {
      const [, prefix, rawValue, suffix] = envMatch;

      if (line.match(/^\s*(?:public\s+)?[A-Z][A-Z0-9_]*\s*[:{]/)) {
        result.push(line);
        continue;
      }

      const value =
        rawValue.startsWith('"') || rawValue.startsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue;

      if (isEncrypted(value)) {
        result.push(line);
        continue;
      }

      if (rawValue.startsWith('"""')) {
        result.push(line);
        continue;
      }

      const envName = line.trim().split(/\s*=/)[0].trim();
      const context = currentGroup
        ? `${currentGroup.toUpperCase()}_${currentVar}@${envName}`
        : `${currentVar}@${envName}`;
      const encrypted = encryptDeterministic(value, key, context);
      result.push(`${prefix}${encrypted}${suffix}`);
      continue;
    }

    result.push(line);
  }

  // Write encrypted content, then rename to locked path
  writeFileSync(readPath, result.join("\n"));
  if (isUnlockedPath(readPath) && readPath !== lockedPath) {
    renameSync(readPath, lockedPath);
  }
  return lockedPath;
}
```

- [ ] **Step 4: Fix existing tests**

The existing tests in `show-hide.test.ts` write to `config.vars` and expect the file to stay at the same path. They need updating because:
- `showFile` now renames to `.unlocked.vars` and returns the new path
- `hideFile` on an `.unlocked.vars` file renames back to `.vars`

Update each existing test to account for the rename. For example, the "show decrypts encrypted values" test:

```typescript
it("show decrypts encrypted values", () => {
  const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
  const f = join(dir, "config.vars");
  writeFileSync(f, content);
  hideFile(f, key);
  // hideFile on a .vars file (not .unlocked.vars) keeps it at .vars
  const unlocked = showFile(f, key);
  const result = readFileSync(unlocked, "utf8");
  expect(result).toContain("# @vars-state unlocked");
  expect(result).toContain("my-secret");
});
```

And the "hide is deterministic" test:

```typescript
it("hide is deterministic — same output on repeated hide", () => {
  const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "same-value"
}`;
  const f = join(dir, "config.vars");
  writeFileSync(f, content);
  hideFile(f, key);
  const first = readFileSync(f, "utf8");
  const unlocked = showFile(f, key);
  hideFile(unlocked, key);
  const second = readFileSync(f, "utf8");
  expect(first).toBe(second);
});
```

Update the flat values test similarly — after `hideFile` the file stays at `.vars` (since input was `.vars`), after `showFile` it moves to `.unlocked.vars`.

- [ ] **Step 5: Run tests to verify all pass**

Run: `pnpm --filter @vars/node test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/node/src/show-hide.ts packages/node/src/__tests__/show-hide.test.ts
git commit -m "feat(node): hideFile renames .unlocked.vars back to .vars after encrypting"
```

---

### Task 4: Update file resolution helpers

**Files:**
- Modify: `packages/cli/src/utils/context.ts`

- [ ] **Step 1: Update `findVarsFile` to find either variant**

In `packages/cli/src/utils/context.ts`, update the `findVarsFile` function:

```typescript
import { resolve, dirname, join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { getKeyFromEnv, decryptMasterKey } from "@vars/node";
import { isUnlockedPath, toCanonicalPath } from "@vars/node";
import * as prompts from "@clack/prompts";

// ... (CliContext interface unchanged)

/** Find the nearest .vars file, walking up from startDir */
export function findVarsFile(startDir: string, fileName?: string): string | null {
  if (fileName) {
    const abs = resolve(startDir, fileName);
    if (existsSync(abs)) return abs;
    // Try the other variant
    if (isUnlockedPath(abs)) {
      const locked = toCanonicalPath(abs);
      if (existsSync(locked)) return locked;
    } else {
      const unlocked = abs.replace(/\.vars$/, ".unlocked.vars");
      if (existsSync(unlocked)) return unlocked;
    }
    return null;
  }
  let dir = resolve(startDir);
  while (true) {
    try {
      const files = readdirSync(dir).filter(f => f.endsWith(".vars") && !f.startsWith("."));
      // Prefer .unlocked.vars over .vars (most recent state), but deduplicate
      const seen = new Set<string>();
      const result: string[] = [];
      for (const f of files) {
        const canonical = isUnlockedPath(f) ? f.replace(/\.unlocked\.vars$/, ".vars") : f;
        if (!seen.has(canonical)) {
          seen.add(canonical);
          // Prefer unlocked variant if it exists
          const unlockedName = canonical.replace(/\.vars$/, ".unlocked.vars");
          if (files.includes(unlockedName)) {
            result.push(resolve(dir, unlockedName));
          } else {
            result.push(resolve(dir, f));
          }
        }
      }
      if (result.length > 0) return result[0];
    } catch { /* permission error, skip */ }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
```

- [ ] **Step 2: Update `findAllVarsFiles` to find and deduplicate**

```typescript
/** Find all .vars files recursively in a directory */
export function findAllVarsFiles(rootDir: string): string[] {
  const results: string[] = [];
  const SKIP = new Set(["node_modules", ".git", "dist", ".vars"]);
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.name.endsWith(".vars")) results.push(fullPath);
      }
    } catch { /* permission error */ }
  }
  walk(rootDir);
  return results;
}

/** Find all .unlocked.vars files in a directory */
export function findUnlockedVarsFiles(rootDir: string): string[] {
  return findAllVarsFiles(rootDir).filter(f => isUnlockedPath(f));
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `pnpm --filter @vars/node test && pnpm --filter @vars/core test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/utils/context.ts
git commit -m "feat(cli): update file resolution to find both .vars and .unlocked.vars"
```

---

### Task 5: Update `use` resolver to find either variant

**Files:**
- Modify: `packages/node/src/use-resolver.ts`

- [ ] **Step 1: Update resolveFile to check for unlocked variant**

In `packages/node/src/use-resolver.ts`, update the `resolveFile` function's file reading:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse, resolveAll } from "@vars/core";
import { isUnlockedPath } from "./unlocked-path.js";
import type { Declaration, Import, ResolvedVars, Param, Check } from "@vars/core";
```

Then in `resolveFile`, update the import path resolution:

```typescript
  for (const imp of ast.imports) {
    let importPath = resolve(dirname(absPath), imp.path);
    // Try unlocked variant if locked path doesn't exist
    if (!existsSync(importPath) && !isUnlockedPath(importPath)) {
      const unlockedPath = importPath.replace(/\.vars$/, ".unlocked.vars");
      if (existsSync(unlockedPath)) {
        importPath = unlockedPath;
      }
    }
    const imported = resolveFile(importPath, new Set(visited));
```

- [ ] **Step 2: Run use-resolver tests**

Run: `pnpm --filter @vars/node test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/node/src/use-resolver.ts
git commit -m "feat(node): use resolver falls back to .unlocked.vars when .vars not found"
```

---

### Task 6: Update CLI commands (show, hide, toggle)

**Files:**
- Modify: `packages/cli/src/commands/show.ts`
- Modify: `packages/cli/src/commands/hide.ts`
- Modify: `packages/cli/src/commands/toggle.ts`

- [ ] **Step 1: Update show.ts**

```typescript
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { showFile, isUnlockedPath, toUnlockedPath, toCanonicalPath } from "@vars/node";
import { findVarsFile, findKeyFile, requireKey } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "show", description: "Decrypt a .vars file (renames to .unlocked.vars)" },
  args: {
    file: { type: "positional", required: false, description: ".vars file to decrypt" },
  },
  async run({ args }) {
    let file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }

    // Normalize to canonical path for resolution
    const canonical = toCanonicalPath(file);
    const unlockedPath = toUnlockedPath(canonical);

    // If only unlocked exists, already shown
    if (!existsSync(canonical) && existsSync(unlockedPath)) {
      console.log(pc.dim(`  Already unlocked: ${unlockedPath}`));
      return;
    }

    if (!existsSync(file)) {
      console.error(pc.red(`File not found: ${file}`));
      process.exit(1);
    }

    const keyFile = findKeyFile(file);
    const key = await requireKey(keyFile);
    const resultPath = showFile(file, key);
    console.log(pc.green(`  ✓ Decrypted → ${resultPath}`));
  },
});
```

- [ ] **Step 2: Update hide.ts**

```typescript
import { defineCommand } from "citty";
import { hideFile } from "@vars/node";
import { findUnlockedVarsFiles, findKeyFile, requireKey, getProjectRoot } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "hide", description: "Encrypt all unlocked .vars files" },
  args: {},
  async run() {
    const root = getProjectRoot();
    const unlocked = findUnlockedVarsFiles(root);

    if (unlocked.length === 0) {
      console.log(pc.dim("  No unlocked files found"));
      return;
    }

    const keyFile = findKeyFile(process.cwd());
    const key = await requireKey(keyFile);

    for (const f of unlocked) {
      const lockedPath = hideFile(f, key);
      console.log(pc.green(`  ✓ Encrypted → ${lockedPath}`));
    }
  },
});
```

- [ ] **Step 3: Update toggle.ts**

```typescript
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { showFile, hideFile, isUnlockedPath, toUnlockedPath, toCanonicalPath } from "@vars/node";
import { findVarsFile, findKeyFile, requireKey } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "toggle", description: "Toggle between locked/unlocked state" },
  args: {
    file: { type: "positional", required: false },
  },
  async run({ args }) {
    const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }

    const canonical = toCanonicalPath(file);
    const unlockedPath = toUnlockedPath(canonical);
    const isUnlocked = isUnlockedPath(file) || existsSync(unlockedPath);

    const keyFile = findKeyFile(file);
    const key = await requireKey(keyFile);

    if (isUnlocked) {
      const target = existsSync(unlockedPath) ? unlockedPath : file;
      const lockedPath = hideFile(target, key);
      console.log(pc.green(`  ✓ Locked → ${lockedPath}`));
    } else {
      const resultPath = showFile(file, key);
      console.log(pc.green(`  ✓ Unlocked → ${resultPath}`));
    }
  },
});
```

- [ ] **Step 4: Build and verify**

Run: `pnpm --filter @vars/cli build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/show.ts packages/cli/src/commands/hide.ts packages/cli/src/commands/toggle.ts
git commit -m "feat(cli): update show/hide/toggle for unlocked file rename pattern"
```

---

### Task 7: Update `vars init` (gitignore + pre-commit hook)

**Files:**
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Update gitignore entries**

In `packages/cli/src/commands/init.ts`, change the gitignore section (around line 91):

```typescript
    const varsIgnoreEntries = "\n# vars\n.vars/key\n.vars/key.*\n*.unlocked.vars\n";
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf8");
      if (!existing.includes("*.unlocked.vars")) {
        appendFileSync(gitignorePath, varsIgnoreEntries);
      }
    } else {
      writeFileSync(gitignorePath, varsIgnoreEntries.trim() + "\n");
    }
```

- [ ] **Step 2: Update pre-commit hook**

Replace the `HOOK_SCRIPT` in the pre-commit hook section:

```typescript
      const HOOK_MARKER = "# vars: check for unlocked files";
      const HOOK_SCRIPT = `\n${HOOK_MARKER}\nif git diff --cached --name-only 2>/dev/null | grep -q '\\.unlocked\\.vars$'; then\n  echo ""\n  echo "vars: Unlocked .vars files cannot be committed."\n  echo "  Run 'vars hide' to encrypt before committing."\n  echo ""\n  exit 1\nfi\n`;
```

- [ ] **Step 3: Build and verify**

Run: `pnpm --filter @vars/cli build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/init.ts
git commit -m "feat(cli): add *.unlocked.vars to gitignore and simplify pre-commit hook"
```

---

### Task 8: Update VS Code extension

**Files:**
- Modify: `packages/vscode/package.json`
- Modify: `packages/vscode/src/extension.ts`

- [ ] **Step 1: Update `when` clauses in package.json**

Replace the menus section:

```json
"menus": {
  "editor/title": [
    {
      "command": "vars.show",
      "when": "resourceLangId == vars && !(resourceFilename =~ /\\.unlocked\\.vars$/)",
      "group": "navigation"
    },
    {
      "command": "vars.hide",
      "when": "resourceLangId == vars && resourceFilename =~ /\\.unlocked\\.vars$/",
      "group": "navigation"
    }
  ]
}
```

- [ ] **Step 2: Simplify extension.ts — remove updateVarsState and setContext**

Remove the `updateVarsState` function (lines 13-24) and all references to it:
- Remove the function definition
- Remove the initial call on line 62-64
- Remove the `onDidChangeActiveTextEditor` listener (lines 66-68)
- Remove the `onDidChangeTextDocument` listener (lines 69-73)
- Remove the `updateVarsState` call in the command handler (line 99)
- Remove the `updateVarsState` call in the watcher (lines 119-121)

The resulting extension.ts should be:

```typescript
import * as path from "node:path";
import * as cp from "node:child_process";
import { type ExtensionContext, commands, window, workspace } from "vscode";
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
	const serverModule = context.asAbsolutePath(
		path.join("dist", "server.js"),
	);

	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.stdio,
		},
		debug: {
			module: serverModule,
			transport: TransportKind.stdio,
			options: {
				execArgv: ["--nolazy", "--inspect=6009"],
			},
		},
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "vars" }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher("**/*.vars"),
		},
	};

	client = new LanguageClient(
		"varsLanguageServer",
		"Vars Language Server",
		serverOptions,
		clientOptions,
	);

	client.start();

	// --- vars commands with PIN dialog ---
	for (const cmd of ["toggle", "show", "hide"] as const) {
		const disposable = commands.registerCommand(`vars.${cmd}`, async () => {
			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				window.showErrorMessage("vars: No workspace folder open.");
				return;
			}

			const pin = await window.showInputBox({
				prompt: "Enter your vars PIN",
				password: true,
				placeHolder: "PIN",
			});

			if (!pin) return;

			try {
				await runVarsWithPin(cmd, pin, workspaceFolder.uri.fsPath);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes("Invalid PIN")) {
					window.showErrorMessage("vars: Invalid PIN.");
				} else {
					window.showErrorMessage(`vars ${cmd}: ${msg}`);
				}
			}
		});
		context.subscriptions.push(disposable);
	}

	// --- File watcher for auto-regen on save ---
	const watcher = workspace.createFileSystemWatcher("**/*.vars");

	let regenTimer: ReturnType<typeof setTimeout> | undefined;
	watcher.onDidChange(async () => {
		if (regenTimer) clearTimeout(regenTimer);
		regenTimer = setTimeout(() => {
			const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!cwd) return;
			cp.execFile("vars", ["gen"], { cwd, timeout: 5000 }, () => {});
		}, 500);
	});

	context.subscriptions.push(watcher);
}

function runVarsWithPin(subcommand: string, pin: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = cp.spawn("vars", [subcommand], { cwd });

		let stderr = "";
		child.stderr.on("data", (data) => { stderr += data.toString(); });

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(stderr.trim() || `vars ${subcommand} exited with code ${code}`));
			}
		});

		child.on("error", (err) => {
			reject(new Error(`Failed to run vars: ${err.message}`));
		});

		child.stdin.write(pin + "\n");
		child.stdin.end();
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
```

- [ ] **Step 3: Build extension**

Run: `cd packages/vscode && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/vscode/package.json packages/vscode/src/extension.ts
git commit -m "feat(vscode): switch to filename-based show/hide buttons, remove setContext"
```

---

### Task 9: Integration test — full show/hide/toggle cycle

**Files:**
- Modify: `packages/node/src/__tests__/show-hide.test.ts`

- [ ] **Step 1: Add integration test**

```typescript
it("full cycle: hide → show → edit → hide produces correct output", () => {
  const content = `# @vars-state unlocked
env(dev, prod)

public APP_NAME = "my-app"
SECRET : z.string() {
  dev = "dev-secret"
  prod = "prod-secret"
}`;
  const locked = join(dir, "config.vars");
  writeFileSync(locked, content);

  // Hide: encrypts and stays at .vars (since input is .vars)
  hideFile(locked, key);
  expect(existsSync(locked)).toBe(true);
  expect(readFileSync(locked, "utf8")).toContain("# @vars-state locked");

  // Show: renames to .unlocked.vars and decrypts
  const unlocked = showFile(locked, key);
  expect(unlocked).toBe(join(dir, "config.unlocked.vars"));
  expect(existsSync(locked)).toBe(false);
  expect(existsSync(unlocked)).toBe(true);
  expect(readFileSync(unlocked, "utf8")).toContain("dev-secret");

  // Simulate edit: change a value
  const edited = readFileSync(unlocked, "utf8").replace("dev-secret", "new-dev-secret");
  writeFileSync(unlocked, edited);

  // Hide: encrypts and renames back to .vars
  const finalLocked = hideFile(unlocked, key);
  expect(finalLocked).toBe(locked);
  expect(existsSync(unlocked)).toBe(false);
  expect(existsSync(locked)).toBe(true);
  const final = readFileSync(locked, "utf8");
  expect(final).toContain("# @vars-state locked");
  expect(final).not.toContain("new-dev-secret");
  expect(final).toContain("enc:v2:aes256gcm-det:");

  // Verify the new value is recoverable
  const unlocked2 = showFile(locked, key);
  expect(readFileSync(unlocked2, "utf8")).toContain("new-dev-secret");
});
```

- [ ] **Step 2: Add both-files-exist edge case test**

```typescript
it("hide overwrites stale .vars when .unlocked.vars is the source of truth", () => {
  const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "latest-secret"
}`;
  const unlocked = join(dir, "config.unlocked.vars");
  const locked = join(dir, "config.vars");
  // Simulate: both files exist (e.g., git restored .vars while .unlocked.vars on disk)
  writeFileSync(unlocked, content);
  writeFileSync(locked, "# stale content");
  hideFile(unlocked, key);

  expect(existsSync(unlocked)).toBe(false);
  expect(existsSync(locked)).toBe(true);
  const result = readFileSync(locked, "utf8");
  expect(result).toContain("enc:v2:aes256gcm-det:");
  expect(result).not.toContain("stale content");
});
```

- [ ] **Step 3: Run all tests**

Run: `pnpm --filter @vars/node test && pnpm --filter @vars/core test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/node/src/__tests__/show-hide.test.ts
git commit -m "test(node): add full show/hide/edit cycle and edge case tests"
```

---

### Task 10: Build all and final verification

- [ ] **Step 1: Build all packages**

Run: `pnpm --filter @vars/core --filter @vars/node --filter @vars/cli --filter @vars/vscode build`
Expected: All builds succeed

- [ ] **Step 2: Run all tests**

Run: `pnpm --filter @vars/core test && pnpm --filter @vars/node test`
Expected: All tests PASS

- [ ] **Step 3: Manual smoke test**

```bash
# Create a temp project
cd /tmp && mkdir vars-rename-test && cd vars-rename-test
git init && npm init -y
echo 'SECRET=hello' > .env

# Run vars init
vars init  # Enter PIN: 1234, confirm: 1234

# Verify config.vars exists
cat config.vars

# Show (should rename to config.unlocked.vars)
vars show
ls *.vars  # Should show config.unlocked.vars, NOT config.vars

# Hide (should rename back to config.vars)
vars hide
ls *.vars  # Should show config.vars, NOT config.unlocked.vars

# Verify gitignore
grep 'unlocked.vars' .gitignore  # Should find *.unlocked.vars

# Cleanup
rm -rf /tmp/vars-rename-test
```

- [ ] **Step 4: Commit if needed**

```bash
git add -A
git commit -m "chore: final build verification"
```

---

### Task 11: Update v2 design doc references

**Files:**
- Modify: `docs/superpowers/specs/2026-03-22-vars-v2-design.md`

- [ ] **Step 1: Update Section 3 (Encryption Model)**

Around line 253, after "One file per config", update the description to note that unlocked files are renamed to `*.unlocked.vars` and gitignored. Update the "Committed (locked) state" and "Working (unlocked) state" examples to show the filename change. Update the Safety Layers subsection to list three layers: gitignore (`*.unlocked.vars`), pre-commit hook (filename check), and state header (secondary signal).

- [ ] **Step 2: Update Section 6 (CLI Commands)**

Around line 575-576, update:
- `vars show [file]` description: "Rename to `.unlocked.vars` and decrypt in-place. Does NOT modify `use` dependencies."
- `vars hide` description: "Encrypt all `*.unlocked.vars` files and rename back to `*.vars`."

- [ ] **Step 3: Update Appendix B (File Layout)**

Add `*.unlocked.vars` to the file layout examples with a note that they are gitignored.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-03-22-vars-v2-design.md
git commit -m "docs: update v2 design doc for unlocked file rename pattern"
```
