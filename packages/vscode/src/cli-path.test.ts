import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { isPathInside, resolveCliPath } from "./cli-path.js";

describe("resolveCliPath", () => {
	it("does not treat a Windows path on another drive as contained", () => {
		expect(isPathInside("C:\\workspace", "D:\\vars.exe", path.win32)).toBe(false);
	});

	it("accepts only an absolute executable outside the workspace", () => {
		const root = mkdtempSync(path.join(tmpdir(), "vars-vscode-"));
		const workspace = path.join(root, "workspace");
		const executable = path.join(root, "vars");
		mkdirSync(workspace);
		writeFileSync(executable, "#!/bin/sh\n");
		chmodSync(executable, 0o755);

		expect(resolveCliPath(executable, [workspace])).toBe(executable);
		expect(() => resolveCliPath("vars", [workspace])).toThrow("absolute path");
		expect(() => resolveCliPath(path.join(workspace, "vars"), [workspace])).toThrow();

		const link = path.join(root, "trusted-link");
		const planted = path.join(workspace, "vars");
		writeFileSync(planted, "#!/bin/sh\n");
		chmodSync(planted, 0o755);
		symlinkSync(planted, link);
		expect(() => resolveCliPath(link, [workspace])).toThrow("outside the workspace");
	});
});
