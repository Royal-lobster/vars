import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decryptMasterKey, encryptMasterKey } from "@dotvars/node";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import initCommand, { publishInitialization } from "../commands/init.js";
import keyCommand from "../commands/key.js";
import { findKeyFile, getProjectRoot, requireKey, resolveKeyFile } from "../utils/context.js";

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

describe("findKeyFile in linked git worktrees", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = makeTmpDir();
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	function makeRepoWithWorktree(): { primary: string; worktree: string } {
		const primary = join(tmp, "primary");
		const nested = join(primary, "apps", "web");
		mkdirSync(nested, { recursive: true });
		writeFileSync(join(primary, ".gitignore"), ".varskey\n");
		writeFileSync(join(nested, "config.vars"), "env(dev)\n");
		const git = (cmd: string, cwd: string) => execSync(`git ${cmd}`, { cwd, stdio: "pipe" });
		git("init --quiet", primary);
		git("add -A", primary);
		git("-c user.email=t@t -c user.name=t commit --quiet -m init", primary);
		const worktree = join(tmp, "linked");
		git(`worktree add --quiet ${worktree}`, primary);
		return { primary, worktree };
	}

	it("falls back to the mirrored path in the primary checkout", () => {
		const { primary, worktree } = makeRepoWithWorktree();
		const keyPath = join(primary, "apps", "web", ".varskey");
		writeFileSync(keyPath, "pin:v1:aes256gcm:master:a:b:c:d\n");
		expect(findKeyFile(join(worktree, "apps", "web"))).toBe(keyPath);
	});

	it("falls back when given a .vars file path, as vars run does", () => {
		const { primary, worktree } = makeRepoWithWorktree();
		const keyPath = join(primary, ".varskey");
		writeFileSync(keyPath, "pin:v1:aes256gcm:master:a:b:c:d\n");
		expect(findKeyFile(join(worktree, "apps", "web", "config.vars"))).toBe(keyPath);
	});
	it("walks up to the primary checkout root when the key lives there", () => {
		const { primary, worktree } = makeRepoWithWorktree();
		const keyPath = join(primary, ".varskey");
		writeFileSync(keyPath, "pin:v1:aes256gcm:master:a:b:c:d\n");
		expect(findKeyFile(join(worktree, "apps", "web"))).toBe(keyPath);
	});

	it("returns null when the primary checkout has no key either", () => {
		const { worktree } = makeRepoWithWorktree();
		expect(findKeyFile(join(worktree, "apps", "web"))).toBeNull();
	});

	it("does not fall back outside a linked worktree", () => {
		// A plain repo with no key anywhere on the walk must stay null.
		const repo = join(tmp, "plain");
		mkdirSync(repo, { recursive: true });
		execSync("git init --quiet", { cwd: repo });
		expect(findKeyFile(repo)).toBeNull();
	});
});

describe("--pin", () => {
	let tmp: string;
	const originalEnvKey = process.env.VARS_KEY;
	let originalEnvPin: string | undefined;
	let originalEnvPinFile: string | undefined;

	beforeEach(() => {
		tmp = makeTmpDir();
		originalEnvPin = process.env.VARS_PIN;
		originalEnvPinFile = process.env.VARS_PIN_FILE;
	});

	afterEach(() => {
		if (originalEnvPin === undefined) {
			// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
			delete process.env.VARS_PIN;
		} else {
			process.env.VARS_PIN = originalEnvPin;
		}
		if (originalEnvKey === undefined) {
			// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
			delete process.env.VARS_KEY;
		} else {
			process.env.VARS_KEY = originalEnvKey;
		}
		if (originalEnvPinFile === undefined) {
			// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
			delete process.env.VARS_PIN_FILE;
		} else {
			process.env.VARS_PIN_FILE = originalEnvPinFile;
		}
		vi.restoreAllMocks();
		rmSync(tmp, { recursive: true, force: true });
	});

	it("takes precedence over VARS_PIN when unlocking a key", async () => {
		const masterKey = Buffer.alloc(32, 7);
		const keyPath = join(tmp, ".varskey");
		const encryptedKey = await encryptMasterKey(masterKey, "argument-pin");
		writeFileSync(keyPath, `${encryptedKey}\n`);
		process.env.VARS_PIN = "environment-pin";

		const result = await requireKey(keyPath, "vars show", { pin: "argument-pin" });

		expect(result).toEqual({ key: masterKey, scope: "master" });
	});

	it("prefers explicit envelope credentials over VARS_KEY", async () => {
		const envelopeKey = Buffer.alloc(32, 8);
		const keyPath = join(tmp, ".varskey");
		writeFileSync(keyPath, `${await encryptMasterKey(envelopeKey, "argument-pin")}\n`);
		process.env.VARS_KEY = Buffer.alloc(32, 1).toString("base64");

		const result = await requireKey(keyPath, "vars show", {
			pin: "argument-pin",
			preferEnvelope: true,
		});

		expect(result).toEqual({ key: envelopeKey, scope: "master" });
	});

	it("falls back to VARS_KEY when an ambient PIN cannot unlock the envelope", async () => {
		const envKey = Buffer.alloc(32, 2);
		const keyPath = join(tmp, ".varskey");
		writeFileSync(keyPath, `${await encryptMasterKey(Buffer.alloc(32, 3), "right-pin")}\n`);
		process.env.VARS_KEY = envKey.toString("base64");
		process.env.VARS_PIN = "wrong-pin";

		await expect(requireKey(keyPath, "vars check")).resolves.toEqual({
			key: envKey,
			scope: "master",
		});
	});

	it("prefers the envelope over VARS_KEY when a correct ambient PIN is set", async () => {
		const envelopeKey = Buffer.alloc(32, 9);
		const keyPath = join(tmp, ".varskey");
		writeFileSync(keyPath, `${await encryptMasterKey(envelopeKey, "right-pin")}\n`);
		process.env.VARS_KEY = Buffer.alloc(32, 1).toString("base64");
		process.env.VARS_PIN = "right-pin";

		await expect(requireKey(keyPath, "vars show")).resolves.toEqual({
			key: envelopeKey,
			scope: "master",
		});
	});

	it("warns on stderr when falling back from an ambient PIN to VARS_KEY", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const keyPath = join(tmp, ".varskey");
		writeFileSync(keyPath, `${await encryptMasterKey(Buffer.alloc(32, 3), "right-pin")}\n`);
		process.env.VARS_KEY = Buffer.alloc(32, 2).toString("base64");
		process.env.VARS_PIN = "wrong-pin";

		await requireKey(keyPath, "vars check");

		const printed = error.mock.calls.map((c) => c.join(" ")).join("\n");
		expect(printed).toContain("VARS_PIN");
		expect(printed).toContain("falling back to VARS_KEY");
	});

	it("reports the credential source on non-interactive unlock", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const masterKey = Buffer.alloc(32, 6);
		const keyPath = join(tmp, ".varskey");
		const pinPath = join(tmp, "pin");
		writeFileSync(keyPath, `${await encryptMasterKey(masterKey, "file-pin")}\n`);
		writeFileSync(pinPath, "file-pin\n");

		await requireKey(keyPath, "vars show", { pinFile: pinPath });

		const printed = error.mock.calls.map((c) => c.join(" ")).join("\n");
		expect(printed).toContain("unlocked via --pin-file");
	});

	it("surfaces explicit PIN failures instead of falling back to VARS_KEY", async () => {
		const keyPath = join(tmp, ".varskey");
		writeFileSync(keyPath, `${await encryptMasterKey(Buffer.alloc(32, 3), "right-pin")}\n`);
		process.env.VARS_KEY = Buffer.alloc(32, 2).toString("base64");

		await expect(requireKey(keyPath, "vars check", { pin: "wrong-pin" })).rejects.toThrow(
			"Invalid PIN",
		);
	});

	it("falls back to VARS_KEY for missing or empty ambient PIN files", async () => {
		const envKey = Buffer.alloc(32, 4);
		const keyPath = join(tmp, ".varskey");
		const pinPath = join(tmp, "pin");
		writeFileSync(keyPath, `${await encryptMasterKey(Buffer.alloc(32, 5), "right-pin")}\n`);
		process.env.VARS_KEY = envKey.toString("base64");
		process.env.VARS_PIN_FILE = pinPath;

		await expect(requireKey(keyPath, "vars export")).resolves.toEqual({
			key: envKey,
			scope: "master",
		});
		writeFileSync(pinPath, "\r\n");
		await expect(requireKey(keyPath, "vars export")).resolves.toEqual({
			key: envKey,
			scope: "master",
		});
	});

	it("reports a clear error for a missing ambient PIN file without a fallback", async () => {
		process.env.VARS_PIN_FILE = join(tmp, "missing-pin");

		await expect(requireKey(join(tmp, ".varskey"), "vars export")).rejects.toThrow(
			"PIN file not found",
		);
	});

	it("reads a PIN from a file and resolves an external key envelope", async () => {
		const masterKey = Buffer.alloc(32, 9);
		const keyPath = join(tmp, "project-envelope");
		const pinPath = join(tmp, "pin");
		writeFileSync(keyPath, `${await encryptMasterKey(masterKey, "file-pin")}\n`);
		writeFileSync(pinPath, "file-pin\n");

		const result = await requireKey(resolveKeyFile(tmp, keyPath), "vars run", {
			pinFile: pinPath,
		});

		expect(result).toEqual({ key: masterKey, scope: "master" });
	});

	it("initializes without a TTY when supplied", async () => {
		writeFileSync(join(tmp, "package.json"), JSON.stringify({ dependencies: { zod: "^3.24.0" } }));
		vi.spyOn(process, "cwd").mockReturnValue(tmp);

		await runCommand(initCommand, { rawArgs: ["--pin", "agent-pin"] });

		const encryptedKey = readFileSync(join(tmp, ".varskey"), "utf8").trim();
		await expect(decryptMasterKey(encryptedKey, "agent-pin")).resolves.toHaveLength(32);
		expect(existsSync(join(tmp, "config.vars"))).toBe(true);
		expect(existsSync(join(tmp, "config.unlocked.vars"))).toBe(false);
		expect(readFileSync(join(tmp, "config.vars"), "utf8")).not.toContain(
			"postgres://user:pass@localhost",
		);
	});

	it("does not use an ambient VARS_PIN when creating a project", async () => {
		writeFileSync(join(tmp, "package.json"), JSON.stringify({ dependencies: { zod: "^3.24.0" } }));
		process.env.VARS_PIN = "ambient-pin";
		vi.spyOn(process, "cwd").mockReturnValue(tmp);
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);

		await expect(runCommand(initCommand, { rawArgs: [] })).rejects.toThrow("exit");
		expect(existsSync(join(tmp, ".varskey"))).toBe(false);
	});

	it("does not replace a missing envelope for an existing vars config", async () => {
		writeFileSync(join(tmp, "package.json"), "{}");
		writeFileSync(join(tmp, "config.vars"), "SECRET = enc:v2:existing\n");
		vi.spyOn(process, "cwd").mockReturnValue(tmp);

		await expect(runCommand(initCommand, { rawArgs: ["--pin", "new-pin"] })).rejects.toThrow(
			"Import the matching envelope",
		);
		expect(existsSync(join(tmp, ".varskey"))).toBe(false);
	});

	it("does not create a new key for existing locked vars files", async () => {
		writeFileSync(join(tmp, "package.json"), "{}");
		writeFileSync(join(tmp, "config.vars"), "SECRET = enc:v2:existing\n");
		vi.spyOn(process, "cwd").mockReturnValue(tmp);

		await expect(runCommand(keyCommand, { rawArgs: ["init", "--pin", "new-pin"] })).rejects.toThrow(
			"Import the matching envelope",
		);
		expect(existsSync(join(tmp, ".varskey"))).toBe(false);
	});
});

describe("publishInitialization", () => {
	const directories: string[] = [];

	afterEach(() => {
		for (const directory of directories) rmSync(directory, { recursive: true, force: true });
	});

	it("rolls back a newly created key when config publication fails", () => {
		const directory = makeTmpDir();
		directories.push(directory);
		const keyPath = join(directory, ".varskey");
		const configPath = join(directory, "config.vars");
		mkdirSync(configPath);

		expect(() => publishInitialization(keyPath, configPath, "encrypted-key", "config")).toThrow();
		expect(existsSync(keyPath)).toBe(false);
	});
});
