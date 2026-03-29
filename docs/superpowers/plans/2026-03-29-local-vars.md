# `.local.vars` Per-Developer Overrides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic per-developer `.local.vars` override files that layer on top of shared `.vars` files using existing shadowing semantics.

**Architecture:** The local file path is computed from any `.vars` path (locked or unlocked) by a new `toLocalPath()` helper in `@vars/node`. The `resolveUseChain()` function in `use-resolver.ts` gains a post-merge step: after resolving the entry-point file and all its `use` imports, it checks for a `.local.vars` sibling, parses it, and merges its declarations on top. `env()` and `param` from local files are discarded with warnings. Only the entry-point file gets a local overlay (not imported files). The CLI `init` command adds `*.local.vars` to `.gitignore`.

**Tech Stack:** TypeScript, Vitest, `@dotvars/core` (parser), `@dotvars/node` (resolver)

---

### Task 1: Add `toLocalPath()` helper

**Files:**
- Modify: `packages/node/src/unlocked-path.ts`
- Test: `packages/node/src/__tests__/unlocked-path.test.ts`

- [ ] **Step 1: Write failing tests for `toLocalPath()`**

Add these tests to the existing test file:

```typescript
// In packages/node/src/__tests__/unlocked-path.test.ts
// Add import for toLocalPath, isLocalPath alongside existing imports

describe("toLocalPath", () => {
	it("converts locked .vars path to .local.vars", () => {
		expect(toLocalPath("config.vars")).toBe("config.local.vars");
	});

	it("converts unlocked .vars path to .local.vars", () => {
		expect(toLocalPath("config.unlocked.vars")).toBe("config.local.vars");
	});

	it("handles nested paths", () => {
		expect(toLocalPath("services/api/vars.vars")).toBe("services/api/vars.local.vars");
	});

	it("handles unlocked nested paths", () => {
		expect(toLocalPath("services/api/vars.unlocked.vars")).toBe("services/api/vars.local.vars");
	});
});

describe("isLocalPath", () => {
	it("returns true for .local.vars files", () => {
		expect(isLocalPath("config.local.vars")).toBe(true);
	});

	it("returns false for regular .vars files", () => {
		expect(isLocalPath("config.vars")).toBe(false);
	});

	it("returns false for unlocked .vars files", () => {
		expect(isLocalPath("config.unlocked.vars")).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/node && pnpm vitest run src/__tests__/unlocked-path.test.ts`
Expected: FAIL — `toLocalPath` and `isLocalPath` are not exported

- [ ] **Step 3: Implement `toLocalPath()` and `isLocalPath()`**

Add to `packages/node/src/unlocked-path.ts`:

```typescript
/** Convert any .vars path (locked or unlocked) to its .local.vars counterpart */
export function toLocalPath(filePath: string): string {
	return toCanonicalPath(filePath).replace(/\.vars$/, ".local.vars");
}

/** Check if a path is a local override variant */
export function isLocalPath(filePath: string): boolean {
	return filePath.endsWith(".local.vars");
}
```

- [ ] **Step 4: Export from package index**

Add to `packages/node/src/index.ts`:

```typescript
export { toUnlockedPath, toLockedPath, isUnlockedPath, toCanonicalPath, toLocalPath, isLocalPath } from "./unlocked-path.js";
```

(Replace the existing `toUnlockedPath, toLockedPath, isUnlockedPath, toCanonicalPath` export line.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/node && pnpm vitest run src/__tests__/unlocked-path.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/node/src/unlocked-path.ts packages/node/src/__tests__/unlocked-path.test.ts packages/node/src/index.ts
git commit -m "feat(node): add toLocalPath() and isLocalPath() helpers"
```

---

### Task 2: Merge local file in `resolveUseChain()`

**Files:**
- Modify: `packages/node/src/use-resolver.ts`
- Create: `packages/node/src/__tests__/fixtures/services/api/vars.local.vars`
- Test: `packages/node/src/__tests__/use-resolver.test.ts`

- [ ] **Step 1: Create a local override fixture**

Write `packages/node/src/__tests__/fixtures/services/api/vars.local.vars`:

```vars
# Local dev override
API_KEY : z.string() {
  dev  = "my-local-key"
  prod = "prod-key"
}

DEBUG_MODE = "true"
```

This fixture shadows `API_KEY` (exists in base) and adds `DEBUG_MODE` (new variable).

- [ ] **Step 2: Write failing tests for local override merging**

Add to `packages/node/src/__tests__/use-resolver.test.ts`:

```typescript
describe("local overrides", () => {
	it("shadows base variable with local override", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const apiKey = result.vars.find((v) => v.name === "API_KEY");
		expect(apiKey?.value).toBe("my-local-key");
	});

	it("adds new variables from local file", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const debug = result.vars.find((v) => v.name === "DEBUG_MODE");
		expect(debug?.value).toBe("true");
	});

	it("preserves base variables not overridden by local", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const appName = result.vars.find((v) => v.name === "APP_NAME");
		expect(appName?.value).toBe("api");
	});

	it("includes local file in sourceFiles", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const hasLocal = result.sourceFiles.some((f) => f.endsWith("vars.local.vars"));
		expect(hasLocal).toBe(true);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/node && pnpm vitest run src/__tests__/use-resolver.test.ts`
Expected: FAIL — `API_KEY` is still `"dev-key"`, `DEBUG_MODE` not found

- [ ] **Step 4: Implement local file merging in `resolveUseChain()`**

Modify `packages/node/src/use-resolver.ts`. Add import for `toLocalPath` and `isLocalPath`:

```typescript
import { isLocalPath, isUnlockedPath, toLocalPath, toUnlockedPath } from "./unlocked-path.js";
```

Replace the `resolveUseChain` function with:

```typescript
export function resolveUseChain(filePath: string, options: UseResolveOptions): ResolvedVars {
	const visited = new Set<string>();
	const absPath = resolve(filePath);

	const merged = resolveFile(absPath, visited);

	// Merge local overrides (top-level only — imported files don't get local overlays)
	const localOverrides = mergeLocalFile(absPath, merged);

	const resolved = resolveAll(
		localOverrides.declarations,
		options.env,
		options.params ?? {},
		localOverrides.envs,
		localOverrides.params,
	);

	// Inject source files collected during the chain walk
	resolved.sourceFiles = localOverrides.sourceFiles;

	return resolved;
}
```

Add the `mergeLocalFile` function after `resolveUseChain`:

```typescript
function mergeLocalFile(basePath: string, base: MergedFile): MergedFile {
	// Don't look for local files of local files
	if (isLocalPath(basePath)) return base;

	const localPath = toLocalPath(basePath);
	if (!existsSync(localPath)) return base;

	const content = readFileSync(localPath, "utf8");
	const result = parse(content, localPath);
	const localAst = result.ast;

	// Warn and discard env() declarations from local file
	if (localAst.envs.length > 0) {
		console.warn(`⚠ ${localPath}: env() declaration ignored (inherited from base file)`);
	}

	// Warn and discard param declarations from local file
	for (const param of localAst.params) {
		console.warn(`⚠ ${localPath}: param "${param.name}" ignored (inherited from base file)`);
	}

	// Resolve the local file through the normal resolver (handles use imports)
	const visited = new Set<string>();
	const localMerged = resolveFile(localPath, visited);

	// Local declarations shadow base declarations (same semantics as use shadowing)
	const localNames = new Set(localMerged.declarations.map(getDeclName));
	const mergedDecls: Declaration[] = [];

	for (const decl of base.declarations) {
		if (!localNames.has(getDeclName(decl))) {
			mergedDecls.push(decl);
		}
	}
	mergedDecls.push(...localMerged.declarations);

	return {
		envs: base.envs,
		params: base.params,
		declarations: mergedDecls,
		checks: [...base.checks, ...localAst.checks],
		sourceFiles: [...base.sourceFiles, ...localMerged.sourceFiles],
	};
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/node && pnpm vitest run src/__tests__/use-resolver.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/node/src/use-resolver.ts packages/node/src/__tests__/use-resolver.test.ts packages/node/src/__tests__/fixtures/services/api/vars.local.vars
git commit -m "feat(node): merge .local.vars overrides in resolveUseChain"
```

---

### Task 3: Test edge cases — no local file, unlocked base, env/param warnings

**Files:**
- Create: `packages/node/src/__tests__/fixtures/local-warnings.vars`
- Create: `packages/node/src/__tests__/fixtures/local-warnings.local.vars`
- Test: `packages/node/src/__tests__/use-resolver.test.ts`

- [ ] **Step 1: Create fixtures for warning tests**

Write `packages/node/src/__tests__/fixtures/local-warnings.vars`:

```vars
env(dev, prod)

APP_NAME = "test-app"
```

Write `packages/node/src/__tests__/fixtures/local-warnings.local.vars`:

```vars
env(dev, staging)

param region : enum(us, eu) = us

APP_NAME = "local-app"
```

- [ ] **Step 2: Write edge case tests**

Add to `packages/node/src/__tests__/use-resolver.test.ts`:

```typescript
describe("local overrides — edge cases", () => {
	it("works fine when no local file exists", () => {
		// shared/infra.vars has no .local.vars sibling
		const result = resolveUseChain(resolve(fixtureDir, "shared/infra.vars"), { env: "dev" });
		const logLevel = result.vars.find((v) => v.name === "LOG_LEVEL");
		expect(logLevel?.value).toBe("debug");
	});

	it("warns and discards env() from local file", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("env() declaration ignored"),
		);
		warnSpy.mockRestore();
	});

	it("warns and discards param from local file", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('param "region" ignored'),
		);
		warnSpy.mockRestore();
	});

	it("uses env() from base even when local declares different envs", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(result.envs).toEqual(["dev", "prod"]);
		warnSpy.mockRestore();
	});
});
```

- [ ] **Step 3: Add `vi` import if not already present**

At the top of `packages/node/src/__tests__/use-resolver.test.ts`, ensure `vi` is imported:

```typescript
import { describe, expect, it, vi } from "vitest";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/node && pnpm vitest run src/__tests__/use-resolver.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/node/src/__tests__/use-resolver.test.ts packages/node/src/__tests__/fixtures/local-warnings.vars packages/node/src/__tests__/fixtures/local-warnings.local.vars
git commit -m "test(node): edge cases for .local.vars — no file, env/param warnings"
```

---

### Task 4: Add `*.local.vars` to `.gitignore` in `vars init`

**Files:**
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Update gitignore entries in init command**

In `packages/cli/src/commands/init.ts`, find line 122:

```typescript
const varsIgnoreEntries = "\n# vars\n.vars/key\n.vars/key.*\n*.unlocked.vars\n";
```

Replace with:

```typescript
const varsIgnoreEntries = "\n# vars\n.vars/key\n.vars/key.*\n*.unlocked.vars\n*.local.vars\n";
```

- [ ] **Step 2: Also update the existing-gitignore check to handle both patterns**

In `packages/cli/src/commands/init.ts`, find lines 123-130:

```typescript
if (existsSync(gitignorePath)) {
	const existing = readFileSync(gitignorePath, "utf8");
	if (!existing.includes("*.unlocked.vars")) {
		appendFileSync(gitignorePath, varsIgnoreEntries);
	}
} else {
	writeFileSync(gitignorePath, `${varsIgnoreEntries.trim()}\n`);
}
```

Replace with:

```typescript
if (existsSync(gitignorePath)) {
	const existing = readFileSync(gitignorePath, "utf8");
	if (!existing.includes("*.unlocked.vars")) {
		appendFileSync(gitignorePath, varsIgnoreEntries);
	} else if (!existing.includes("*.local.vars")) {
		appendFileSync(gitignorePath, "*.local.vars\n");
	}
} else {
	writeFileSync(gitignorePath, `${varsIgnoreEntries.trim()}\n`);
}
```

This ensures existing projects that already have `*.unlocked.vars` in `.gitignore` still get `*.local.vars` added.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/init.ts
git commit -m "feat(cli): add *.local.vars to .gitignore in vars init"
```

---

### Task 5: Add CLI notice when local overrides are active

**Files:**
- Modify: `packages/cli/src/commands/run.ts`

- [ ] **Step 1: Add local file detection message to `run` command**

In `packages/cli/src/commands/run.ts`, after line 34 (`const resolved = resolveUseChain(file, { env, params });`), add:

```typescript
// Notify if local overrides are active
const localFile = resolved.sourceFiles.find((f) => f.endsWith(".local.vars"));
if (localFile) {
	const relative = localFile.replace(process.cwd() + "/", "");
	console.error(pc.dim(`  Using local overrides from ${relative}`));
}
```

Using `console.error` so it goes to stderr and doesn't pollute stdout (same pattern as other CLI status messages).

- [ ] **Step 2: Verify the run command still works**

Run: `cd packages/cli && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/run.ts
git commit -m "feat(cli): show notice when .local.vars overrides are active"
```

---

### Task 6: Run full test suite and verify

**Files:** (none — verification only)

- [ ] **Step 1: Run all node package tests**

Run: `cd packages/node && pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run all core package tests**

Run: `cd packages/core && pnpm vitest run`
Expected: All tests PASS (no changes were made to core, this is a sanity check)

- [ ] **Step 3: Run full project build**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run biome lint/format check**

Run: `pnpm biome check --write .`
Expected: No errors (auto-fixes applied if any formatting drift)

- [ ] **Step 5: Final commit if any formatting fixes**

```bash
git add -A
git commit -m "fix: biome formatting"
```

(Only if Step 4 produced changes.)
