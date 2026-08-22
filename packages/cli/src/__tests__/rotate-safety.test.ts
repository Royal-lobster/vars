import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createMasterKey,
	decryptMasterKey,
	encryptMasterKey,
	encryptVarsContent,
	parseKeyFile,
} from "@dotvars/node";
import { afterEach, describe, expect, it, vi } from "vitest";

const atomicWrites = vi.hoisted(() => [] as Array<{ path: string; content: string }>);

vi.mock("../utils/atomic-write.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../utils/atomic-write.js")>();
	return {
		...actual,
		atomicWriteFileSync(path: string, content: string): void {
			atomicWrites.push({ path, content });
			actual.atomicWriteFileSync(path, content);
		},
	};
});

import { rotateFiles } from "../commands/rotate.js";

describe("rotation recoverability", () => {
	const directories: string[] = [];

	afterEach(() => {
		atomicWrites.length = 0;
		for (const directory of directories) rmSync(directory, { recursive: true, force: true });
	});

	it("persists both old and new envelopes before re-encrypting files", async () => {
		const directory = join(tmpdir(), `vars-rotate-safety-${Date.now()}-${Math.random()}`);
		directories.push(directory);
		mkdirSync(directory);
		const file = join(directory, "config.vars");
		const keyFile = join(directory, ".varskey");
		const oldKey = await createMasterKey();
		const newKey = await createMasterKey();
		const oldEnvelope = await encryptMasterKey(oldKey, "old-pin");
		const newEnvelope = await encryptMasterKey(newKey, "new-pin");
		writeFileSync(keyFile, `${oldEnvelope}\n`, { mode: 0o600 });
		writeFileSync(file, await encryptVarsContent('SECRET = "value"\n', oldKey));

		await rotateFiles([file], keyFile, oldKey, newKey, newEnvelope);

		const keyWrites = atomicWrites.filter((write) => write.path === keyFile);
		expect(keyWrites).toHaveLength(2);
		const transitionalEntries = parseKeyFile(keyWrites[0]!.content);
		expect(transitionalEntries).toHaveLength(2);
		await expect(decryptMasterKey(transitionalEntries[0]!.raw, "old-pin")).resolves.toEqual(oldKey);
		await expect(decryptMasterKey(transitionalEntries[1]!.raw, "new-pin")).resolves.toEqual(newKey);
		expect(keyWrites[1]!.content).toBe(`${newEnvelope}\n`);
		expect(readFileSync(file, "utf8")).not.toContain("value");
	});
});
