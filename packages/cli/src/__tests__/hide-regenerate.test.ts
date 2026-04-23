import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateForFile } from "../commands/gen.js";
import { regenerateGeneratedForLockedFile } from "../commands/hide.js";

describe("regenerateGeneratedForLockedFile", () => {
	let dir: string;
	let filePath: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "vars-hide-regenerate-"));
		filePath = join(dir, "config.vars");
		writeFileSync(
			filePath,
			`env(dev, prod)

public APP_NAME = "demo"
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
`,
		);
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("preserves the existing serverless platform when regenerating after hide", () => {
		generateForFile(filePath, "serverless");

		writeFileSync(
			filePath,
			`env(dev, prod)

public APP_NAME = "renamed"
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
`,
		);

		regenerateGeneratedForLockedFile(filePath);

		const generated = readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8");
		expect(generated).toContain("// @vars-platform: serverless");
		expect(generated).toContain("export async function getVars");
		expect(generated).toContain('APP_NAME: "renamed"');
		expect(generated).not.toContain("export const vars: Vars = parseVars(process.env);");
	});

	it("does nothing when there is no existing generated file", () => {
		regenerateGeneratedForLockedFile(filePath);
		expect(() => readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8")).toThrow();
	});

	it("throws when an existing generated file cannot be regenerated", () => {
		generateForFile(filePath, "serverless");
		const original = readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8");
		writeFileSync(
			filePath,
			`env(dev, prod)

public APP_NAME {
  dev = "demo"
  prod = "renamed"
}
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
`,
		);

		expect(() => regenerateGeneratedForLockedFile(filePath)).toThrow(
			/regeneration failed for .*config\.vars:/,
		);
		expect(readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8")).toBe(original);
	});
});
