# Export Command & Doctor .env Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `vars template` to `vars export` with interactive env picker and PIN support, and add stale `.env` file detection to `vars doctor`.

**Architecture:** The existing `generateTemplate()` function does all the heavy lifting (parse, resolve, decrypt, format). We enhance the command layer around it: rename, add `requireKey()` fallback, add interactive env picker via `promptSelect`. Doctor gets a new check scanning for `.env*` files in the project root.

**Tech Stack:** TypeScript, citty (CLI framework), @clack/prompts (interactive UI), vitest (testing)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/cli/src/commands/export.ts` | Create (rename from template.ts) | Export command with env picker + PIN support |
| `packages/cli/src/commands/template.ts` | Delete | Replaced by export.ts |
| `packages/cli/src/__tests__/commands/export.test.ts` | Create (rename from template.test.ts) | Tests for generateTemplate + env listing |
| `packages/cli/src/__tests__/commands/template.test.ts` | Delete | Replaced by export.test.ts |
| `packages/cli/src/index.ts` | Modify | Register `export` command, keep `template` as alias |
| `packages/cli/src/commands/doctor.ts` | Modify | Add stale `.env` file check to Security group |
| `packages/cli/src/__tests__/commands/doctor.test.ts` | Replace entirely | Old tests use stale flat-file format; rewrite for `HealthCheckGroup[]` return type + add `.env` detection tests |

---

### Task 1: Create `export` command (rename from `template`)

**Files:**
- Create: `packages/cli/src/commands/export.ts`
- Delete: `packages/cli/src/commands/template.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Create `export.ts` by copying `template.ts` with the following changes**

The key changes from `template.ts`:
1. Command name: `"export"` instead of `"template"`
2. Use `requireKey()` instead of `getKeyFromEnv()` — supports both `VARS_KEY` env var AND interactive PIN prompt
3. When `--env` is omitted and stdin is TTY: parse the `.vars` file, collect all environments, show a `promptSelect` picker
4. When `--env` is omitted and not TTY: default to `"dev"`
5. Update the generated comment header to say `vars export`

```typescript
import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, decrypt, isEncrypted, resolveValue } from "@vars/core";
import { buildContext, requireKey, getKeyFromEnv, findVarsFile } from "../utils/context.js";
import { promptSelect } from "../utils/prompt.js";
import * as output from "../utils/output.js";

/**
 * Collect all unique environment names from a parsed .vars file.
 * Excludes "default" since it's a fallback, not a selectable environment.
 */
export function listEnvironments(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);
  const envSet = new Set<string>();
  for (const v of parsed.variables) {
    for (const val of v.values) {
      if (val.env !== "default") {
        envSet.add(val.env);
      }
    }
  }
  return [...envSet].sort();
}

export default defineCommand({
  meta: {
    name: "export",
    description: "Export decrypted vars as .env format to stdout",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to export",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    // Two separate TTY checks:
    // canPrompt: whether we can show interactive prompts (needs both stdin + stderr)
    // showChrome: whether we should show clack intro/outro (only needs stderr)
    const canPrompt = process.stdin.isTTY && process.stderr.isTTY;
    const showChrome = !!process.stderr.isTTY;

    // Resolve file path without building full context yet
    const varsFilePath = args.file
      ? resolve(process.cwd(), args.file)
      : findVarsFile() ?? resolve(process.cwd(), ".vars", "vault.vars");

    // Resolve env: flag > interactive picker > "dev" fallback
    let env = args.env;

    if (!env && canPrompt) {
      const envs = listEnvironments(varsFilePath);
      if (envs.length > 0) {
        output.intro("export");
        env = await promptSelect("Select environment", envs);
      } else {
        env = "dev";
      }
    } else if (!env) {
      env = "dev";
    }

    // Build context with resolved env
    const ctx = buildContext({ file: args.file, env });

    // Get key: VARS_KEY env var or interactive PIN prompt
    let key: Buffer | null = getKeyFromEnv();
    if (!key) {
      key = await requireKey(ctx);
    }

    const result = generateExport(ctx.varsFilePath, ctx.env, key);

    process.stdout.write(result);

    if (showChrome) {
      const lineCount = result.split("\n").filter((l) => l && !l.startsWith("#")).length;
      output.outro(`Exported ${lineCount} variable${lineCount !== 1 ? "s" : ""} (@${ctx.env})`);
    }
  },
});

/**
 * Generate a .env-formatted string from a .vars file.
 */
export function generateExport(
  filePath: string,
  env: string,
  key: Buffer | null,
): string {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);
  const lines: string[] = [];

  lines.push(`# Generated by 'vars export --env ${env}'`);
  lines.push(`# Source: ${filePath}`);
  lines.push("");

  for (const v of parsed.variables) {
    const raw = resolveValue(v, env);
    if (raw === undefined) continue;

    let value = raw;
    if (isEncrypted(value)) {
      if (key) {
        value = decrypt(value, key);
      } else {
        continue;
      }
    }

    if (value.includes(" ") || value.includes("#") || value.includes("=")) {
      lines.push(`${v.name}="${value}"`);
    } else {
      lines.push(`${v.name}=${value}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
```

- [ ] **Step 2: Delete `template.ts`**

```bash
rm packages/cli/src/commands/template.ts
```

- [ ] **Step 3: Update `index.ts` — register `export`, add `template` as alias**

In `packages/cli/src/index.ts`, replace the `template` entry and add `export`:

**Note:** `export` is a reserved keyword in JavaScript, so it must be quoted as a property name.

```typescript
// Replace:
//   template: () => import("./commands/template.js").then((m) => m.default),
// With:
    "export": () => import("./commands/export.js").then((m) => m.default),
    template: () => import("./commands/export.js").then((m) => m.default),
```

Both `vars export` and `vars template` will work, pointing to the same command.

- [ ] **Step 4: Run the build to verify no compilation errors**

Run: `cd packages/cli && pnpm run build` (or `pnpm tsc --noEmit`)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/export.ts packages/cli/src/index.ts
git rm packages/cli/src/commands/template.ts
git commit -m "feat: rename template → export with env picker and PIN support"
```

---

### Task 2: Update export tests

**Files:**
- Create: `packages/cli/src/__tests__/commands/export.test.ts`
- Delete: `packages/cli/src/__tests__/commands/template.test.ts`

- [ ] **Step 1: Create `export.test.ts` with updated tests**

Copy from `template.test.ts`, update imports to use `export.ts`, rename `generateTemplate` → `generateExport`, and add tests for `listEnvironments`.

```typescript
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { generateExport, listEnvironments } from "../../commands/export.js";

describe("vars export", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-export-test-"));
    key = randomBytes(32);
  });

  it("generates a .env-style output from plaintext .vars", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "  @prod    = 8080",
        "",
        "HOST  z.string()",
        "  @default = localhost",
      ].join("\n"),
    );

    const result = generateExport(join(tmpDir, ".vars"), "dev", null);
    expect(result).toContain("PORT=3000");
    expect(result).toContain("HOST=localhost");
  });

  it("decrypts encrypted values when key is provided", () => {
    const encPort = encrypt("8080", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `PORT  z.coerce.number()\n  @prod = ${encPort}\n`,
    );

    const result = generateExport(join(tmpDir, ".vars"), "prod", key);
    expect(result).toContain("PORT=8080");
  });

  it("uses @default when specific env not found", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    const result = generateExport(join(tmpDir, ".vars"), "staging", null);
    expect(result).toContain("PORT=3000");
  });

  it("omits variables with no value for the given env", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PROD_ONLY  z.string()\n  @prod = value\n",
    );

    const result = generateExport(join(tmpDir, ".vars"), "dev", null);
    expect(result).not.toContain("PROD_ONLY");
  });

  it("includes header comment with vars export", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    const result = generateExport(join(tmpDir, ".vars"), "dev", null);
    expect(result).toContain("# Generated by 'vars export --env dev'");
  });

  it("quotes values containing spaces", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "MSG  z.string()\n  @default = hello world\n",
    );

    const result = generateExport(join(tmpDir, ".vars"), "dev", null);
    expect(result).toContain('MSG="hello world"');
  });

  it("skips encrypted values when no key is provided", () => {
    const enc = encrypt("secret", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `SECRET  z.string()\n  @dev = ${enc}\n`,
    );

    const result = generateExport(join(tmpDir, ".vars"), "dev", null);
    expect(result).not.toContain("SECRET");
  });
});

describe("listEnvironments", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-listenv-test-"));
    key = randomBytes(32);
  });

  it("lists all unique environments, sorted, excluding default", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "  @dev     = 3000",
        "  @prod    = 8080",
        "  @staging = 4000",
        "",
        "HOST  z.string()",
        "  @dev  = localhost",
        "  @prod = example.com",
      ].join("\n"),
    );

    const envs = listEnvironments(join(tmpDir, ".vars"));
    expect(envs).toEqual(["dev", "prod", "staging"]);
  });

  it("discovers environments even when values are encrypted", () => {
    const enc = encrypt("secret", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `SECRET  z.string()\n  @prod = ${enc}\n`,
    );

    const envs = listEnvironments(join(tmpDir, ".vars"));
    expect(envs).toEqual(["prod"]);
  });

  it("returns empty array when no environments defined", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    const envs = listEnvironments(join(tmpDir, ".vars"));
    expect(envs).toEqual([]);
  });
});
```

- [ ] **Step 2: Delete old template test**

```bash
rm packages/cli/src/__tests__/commands/template.test.ts
```

- [ ] **Step 3: Run export tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/__tests__/commands/export.test.ts`
Expected: All 10 tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/__tests__/commands/export.test.ts
git rm packages/cli/src/__tests__/commands/template.test.ts
git commit -m "test: update tests for template → export rename"
```

---

### Task 3: Add stale `.env` file detection to doctor

**Files:**
- Modify: `packages/cli/src/commands/doctor.ts:119` (Security group section)

- [ ] **Step 1: Replace `doctor.test.ts` entirely with updated tests**

The existing tests use the old flat `DoctorCheck[]` format and stale file paths (`.vars` as a file, `.vars.key`). The current `runDoctorChecks()` returns `HealthCheckGroup[]` and expects `.vars/vault.vars` + `.vars/key` directory structure. Replace the entire file contents:

```typescript
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { runDoctorChecks } from "../../commands/doctor.js";
import type { HealthCheckGroup } from "../../utils/output.js";

// Helper to find a check by label substring across all groups
function findCheck(groups: HealthCheckGroup[], labelSubstring: string) {
  for (const group of groups) {
    for (const check of group.checks) {
      if (check.label.includes(labelSubstring)) return check;
    }
  }
  return undefined;
}

describe("vars doctor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-doctor-test-"));
  });

  it("warns when stale .env files exist in project root", () => {
    // Create .vars directory structure
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    // Create stale .env file
    writeFileSync(join(tmpDir, ".env"), "PORT=3000\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, ".env");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("warn");
  });

  it("warns when stale .env.local files exist", () => {
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    writeFileSync(join(tmpDir, ".env.local"), "SECRET=abc\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, ".env");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("warn");
  });

  it("passes when no .env files exist", () => {
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, "No stale .env files");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("pass");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/cli && pnpm vitest run src/__tests__/commands/doctor.test.ts`
Expected: FAIL — the stale `.env` check doesn't exist yet

- [ ] **Step 3: Implement `.env` file detection in `doctor.ts`**

In `packages/cli/src/commands/doctor.ts`, insert immediately before the `// ── Secrets Health group` comment (line 240), after the `securityChecks.push` for the encryption check:

```typescript
  // Stale .env file detection
  const envFilePatterns = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
    ".env.staging",
    ".env.test",
    ".env.test.local",
  ];

  const foundEnvFiles = envFilePatterns.filter((f) =>
    existsSync(join(projectRoot, f)),
  );

  if (foundEnvFiles.length > 0) {
    securityChecks.push({
      label: `Stale .env file${foundEnvFiles.length !== 1 ? "s" : ""} found: ${foundEnvFiles.join(", ")}`,
      status: "warn",
      message: "Likely leftover from before migration",
      suggestion: `Delete ${foundEnvFiles.join(", ")} — your secrets are now in .vars`,
    });
  } else {
    securityChecks.push({
      label: "No stale .env files",
      status: "pass",
      message: "",
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run src/__tests__/commands/doctor.test.ts`
Expected: All tests pass

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `cd packages/cli && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/doctor.ts packages/cli/src/__tests__/commands/doctor.test.ts
git commit -m "feat: add stale .env file detection to vars doctor"
```
