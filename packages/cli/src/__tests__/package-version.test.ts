import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPackageVersion } from "../utils/package-version.js";

describe("readPackageVersion", () => {
	it("uses the CLI package version", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as { version: string };

		expect(readPackageVersion(new URL("../index.ts", import.meta.url).href)).toBe(
			packageJson.version,
		);
	});
});
