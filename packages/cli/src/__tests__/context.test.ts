import { execSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProjectRoot } from "../utils/context.js";

function makeTmpDir(): string {
	const dir = join(tmpdir(), `vars-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	// Resolve symlinks (macOS /var → /private/var) so expectations match
	// getProjectRoot's normalized output.
	return realpathSync(dir);
}

describe("getProjectRoot", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = makeTmpDir();
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	it("returns the nearest ancestor directory containing package.json", () => {
		const pkgDir = join(tmp, "apps", "backend");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(join(pkgDir, "package.json"), "{}");
		// A deeper cwd inside the package should still resolve to pkgDir
		const deeper = join(pkgDir, "src", "routes");
		mkdirSync(deeper, { recursive: true });
		expect(getProjectRoot(deeper)).toBe(pkgDir);
	});

	it("prefers the inner package.json over an outer one (monorepo)", () => {
		const rootPkg = tmp;
		const innerPkg = join(tmp, "apps", "backend");
		mkdirSync(innerPkg, { recursive: true });
		writeFileSync(join(rootPkg, "package.json"), "{}");
		writeFileSync(join(innerPkg, "package.json"), "{}");
		expect(getProjectRoot(innerPkg)).toBe(innerPkg);
	});

	it("walks up to an outer package.json when the current directory lacks one", () => {
		const rootPkg = tmp;
		writeFileSync(join(rootPkg, "package.json"), "{}");
		const sub = join(tmp, "scripts", "helpers");
		mkdirSync(sub, { recursive: true });
		expect(getProjectRoot(sub)).toBe(rootPkg);
	});

	it("falls back to startDir when no package.json is found", () => {
		const sub = join(tmp, "nested");
		mkdirSync(sub, { recursive: true });
		// tmp is not a git repo and has no package.json
		expect(getProjectRoot(sub)).toBe(sub);
	});

	it("does not climb above the git root into an unrelated package.json", () => {
		// Simulate `~/package.json` sitting above a git repo
		const outerPkg = join(tmp, "outside-package.json-dir");
		const repo = join(outerPkg, "repo");
		const subdir = join(repo, "scripts");
		mkdirSync(subdir, { recursive: true });
		writeFileSync(join(outerPkg, "package.json"), "{}");
		execSync("git init --quiet", { cwd: repo });
		// repo has no package.json anywhere; getProjectRoot must stop at the git
		// root instead of returning outerPkg.
		expect(getProjectRoot(subdir)).toBe(repo);
	});
});
