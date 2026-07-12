import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMasterKey, hideFile } from "@dotvars/node";
import { afterEach, describe, expect, it } from "vitest";
import { rotateFiles } from "../commands/rotate.js";

describe("rotateFiles", () => {
	const dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
	});

	it("restores every file and key when rotation fails", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rotate-"));
		dirs.push(dir);
		const oldKey = await createMasterKey();
		const newKey = await createMasterKey();
		const first = join(dir, "a.vars");
		const second = join(dir, "b.vars");
		const keyFile = join(dir, ".varskey");
		writeFileSync(first, 'SECRET = "first"');
		writeFileSync(second, 'SECRET = """\nsecond\n"""');
		await hideFile(first, oldKey);
		writeFileSync(second, `${readFileSync(first, "utf8")}\nSECRET2 = """\nsecond\n"""`);
		writeFileSync(keyFile, "old-key\n");
		const before = [readFileSync(first), readFileSync(second)];

		await expect(rotateFiles([first, second], keyFile, oldKey, newKey, "new-key")).rejects.toThrow(
			"multiline secret",
		);
		expect(readFileSync(keyFile, "utf8")).toBe("old-key\n");
		expect(readFileSync(first)).toEqual(before[0]);
		expect(readFileSync(second)).toEqual(before[1]);
	});
});
