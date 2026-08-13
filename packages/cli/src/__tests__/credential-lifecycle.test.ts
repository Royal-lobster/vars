import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createMasterKey,
	decryptMasterKey,
	encryptMasterKey,
	encryptVarsContent,
	parseKeyFile,
} from "@dotvars/node";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import keyCommand from "../commands/key.js";
import pinCommand from "../commands/pin.js";
import rotateCommand from "../commands/rotate.js";

describe("non-interactive credential lifecycle", () => {
	let directory: string;
	let masterKey: Buffer;

	beforeEach(async () => {
		directory = join(tmpdir(), `vars-credentials-${Date.now()}-${Math.random()}`);
		mkdirSync(directory);
		writeFileSync(join(directory, "package.json"), "{}");
		masterKey = await createMasterKey();
		writeFileSync(
			join(directory, ".varskey"),
			`${await encryptMasterKey(masterKey, "master-pin")}\n`,
		);
		writeFileSync(join(directory, "master-pin"), "master-pin\n");
		vi.spyOn(process, "cwd").mockReturnValue(directory);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(directory, { recursive: true, force: true });
	});

	async function writeLockedConfig(content: string): Promise<void> {
		const encrypted = await encryptVarsContent(
			content,
			masterKey,
			"master",
			join(directory, "config.vars"),
		);
		writeFileSync(join(directory, "config.vars"), encrypted);
	}
	it("creates an owner PIN from old and new PIN files without a TTY", async () => {
		writeFileSync(join(directory, "owner-pin"), "owner-pin\n");

		await runCommand(pinCommand, {
			rawArgs: [
				"create",
				"backend",
				"--pin-file",
				join(directory, "master-pin"),
				"--new-pin-file",
				join(directory, "owner-pin"),
			],
		});

		const entries = parseKeyFile(readFileSync(join(directory, ".varskey"), "utf8"));
		expect(entries.map((entry) => entry.scope)).toEqual(["master", "owner:backend"]);
		await expect(decryptMasterKey(entries[1]!.raw, "owner-pin")).resolves.toHaveLength(32);
	});

	it("migrates owner fields without creating an unlocked file", async () => {
		await writeLockedConfig('API_TOKEN = "secret" # owner: backend\n');
		writeFileSync(join(directory, "owner-pin"), "owner-pin\n");

		await runCommand(pinCommand, {
			rawArgs: [
				"create",
				"backend",
				"--pin-file",
				join(directory, "master-pin"),
				"--new-pin-file",
				join(directory, "owner-pin"),
			],
		});

		expect(existsSync(join(directory, "config.unlocked.vars"))).toBe(false);
		expect(readFileSync(join(directory, "config.vars"), "utf8")).not.toContain("secret");
	});

	it("rotates with old and new PIN files without a TTY", async () => {
		writeFileSync(join(directory, "new-pin"), "new-pin\n");

		await runCommand(rotateCommand, {
			rawArgs: [
				"--pin-file",
				join(directory, "master-pin"),
				"--new-pin-file",
				join(directory, "new-pin"),
			],
		});

		const entry = parseKeyFile(readFileSync(join(directory, ".varskey"), "utf8"))[0]!;
		await expect(decryptMasterKey(entry.raw, "master-pin")).rejects.toThrow();
		await expect(decryptMasterKey(entry.raw, "new-pin")).resolves.toHaveLength(32);
	});

	it("rotates encrypted files without creating an unlocked file", async () => {
		await writeLockedConfig('API_TOKEN = "secret"\n');
		writeFileSync(join(directory, "new-pin"), "new-pin\n");

		await runCommand(rotateCommand, {
			rawArgs: [
				"--pin-file",
				join(directory, "master-pin"),
				"--new-pin-file",
				join(directory, "new-pin"),
			],
		});

		expect(existsSync(join(directory, "config.unlocked.vars"))).toBe(false);
		expect(readFileSync(join(directory, "config.vars"), "utf8")).not.toContain("secret");
	});

	it("imports an encrypted envelope without exposing the master key", async () => {
		rmSync(join(directory, ".varskey"));
		const source = join(directory, "provisioned-envelope");
		writeFileSync(source, `${await encryptMasterKey(masterKey, "provisioned-pin")}\n`);

		await runCommand(keyCommand, { rawArgs: ["import", source] });

		const imported = readFileSync(join(directory, ".varskey"), "utf8");
		await expect(decryptMasterKey(imported.trim(), "provisioned-pin")).resolves.toEqual(masterKey);
	});
});
