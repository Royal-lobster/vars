import {
	chmodSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteFileSync } from "../utils/atomic-write.js";

describe("atomicWriteFileSync", () => {
	const directories: string[] = [];

	afterEach(() => {
		for (const directory of directories) rmSync(directory, { recursive: true, force: true });
	});

	it("preserves existing file permissions", () => {
		const directory = join(tmpdir(), `vars-atomic-${Date.now()}-${Math.random()}`);
		directories.push(directory);
		mkdirSync(directory);
		const file = join(directory, ".varskey");
		writeFileSync(file, "old\n");
		chmodSync(file, 0o666);

		atomicWriteFileSync(file, "new\n");

		expect(statSync(file).mode & 0o777).toBe(0o666);
		expect(readFileSync(file, "utf8")).toBe("new\n");
	});

	it("uses target-specific temp files and removes them after replacement", () => {
		const directory = join(tmpdir(), `vars-atomic-${Date.now()}-${Math.random()}`);
		directories.push(directory);
		mkdirSync(directory);
		const first = join(directory, "first.vars");
		const second = join(directory, "second.vars");

		atomicWriteFileSync(first, "first\n");
		atomicWriteFileSync(second, "second\n");

		expect(readFileSync(first, "utf8")).toBe("first\n");
		expect(readFileSync(second, "utf8")).toBe("second\n");
		expect(readdirSync(directory)).toEqual(["first.vars", "second.vars"]);
	});
});
