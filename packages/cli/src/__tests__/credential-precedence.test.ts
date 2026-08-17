import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptMasterKey, encryptVarsContent } from "@dotvars/node";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import checkCommand from "../commands/check.js";
import exportCommand from "../commands/export.js";
import runVarsCommand from "../commands/run.js";

describe("explicit credential precedence", () => {
	let directory: string;
	let file: string;
	let keyFile: string;
	let pinFile: string;

	beforeEach(async () => {
		directory = join(tmpdir(), `vars-credential-precedence-${Date.now()}-${Math.random()}`);
		mkdirSync(directory);
		file = join(directory, "config.vars");
		keyFile = join(directory, ".varskey");
		pinFile = join(directory, "pin");
		const key = Buffer.alloc(32, 8);
		writeFileSync(keyFile, `${await encryptMasterKey(key, "explicit-pin")}\n`);
		writeFileSync(pinFile, "explicit-pin\n");
		writeFileSync(
			file,
			await encryptVarsContent('env(dev)\nSECRET : z.literal("correct") = "correct"\n', key),
		);
		vi.stubEnv("VARS_KEY", Buffer.alloc(32, 1).toString("base64"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		rmSync(directory, { recursive: true, force: true });
	});

	it("export honors explicit key and PIN flags over VARS_KEY", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await runCommand(exportCommand, {
			rawArgs: ["--env", "dev", "--key-file", keyFile, "--pin", "explicit-pin", file],
		});

		expect(log).toHaveBeenCalledWith('SECRET="correct"');
	});

	it("check honors explicit key and PIN files over VARS_KEY", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});

		await runCommand(checkCommand, {
			rawArgs: ["--env", "dev", "--file", file, "--key-file", keyFile, "--pin-file", pinFile],
		});
	});

	it("run honors explicit key and PIN files over VARS_KEY", async () => {
		const output = join(directory, "run-output");
		const script = `require("node:fs").writeFileSync(${JSON.stringify(output)}, process.env.SECRET)`;
		vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

		await runCommand(runVarsCommand, {
			rawArgs: [
				"--env",
				"dev",
				"--file",
				file,
				"--key-file",
				keyFile,
				"--pin-file",
				pinFile,
				"--",
				process.execPath,
				"-e",
				script,
			],
		});
		await vi.waitFor(() => expect(existsSync(output)).toBe(true));

		expect(readFileSync(output, "utf8")).toBe("correct");
	});
});
