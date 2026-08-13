import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mutateVarsFile } from "../utils/vars-source-mutation.js";

describe("remove", () => {
	const directories: string[] = [];

	afterEach(() => {
		for (const directory of directories) rmSync(directory, { recursive: true, force: true });
	});

	it("removes the parsed declaration instead of matching multiline value text", async () => {
		const directory = join(tmpdir(), `vars-remove-${Date.now()}`);
		directories.push(directory);
		mkdirSync(directory);
		const file = join(directory, "config.unlocked.vars");
		writeFileSync(
			file,
			`OTHER = """
FOO = "example"
"""
FOO = "real"
`,
		);

		await mutateVarsFile(file, { kind: "remove", target: "FOO" });

		expect(readFileSync(file, "utf8")).toContain('FOO = "example"');
		expect(readFileSync(file, "utf8")).not.toContain('FOO = "real"');
	});
});
