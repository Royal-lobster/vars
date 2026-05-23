import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMasterKey } from "@dotvars/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateForFile } from "../commands/gen.js";
import { hideUnlockedFiles, regenerateGeneratedForLockedFile } from "../commands/hide.js";

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
		expect(generated).toContain("APP_NAME: {");
		expect(generated).toContain('"dev": "renamed"');
		expect(generated).toContain('"prod": "renamed"');
		expect(generated).not.toContain("export const vars: Vars = parseVars(process.env);");
	});

	it("regenerates serverless output when public vars differ across envs", () => {
		writeFileSync(
			filePath,
			`env(dev, prod)

public INBOUND_EMAIL_DOMAIN {
  dev = "in-dev.example.com"
  prod = "in.example.com"
}
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
`,
		);
		generateForFile(filePath, "serverless");

		writeFileSync(
			filePath,
			`env(dev, prod)

public INBOUND_EMAIL_DOMAIN {
  dev = "in-dev.example.com"
  prod = "in.example.com"
}
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
ADDED : z.string() {
  dev = "enc:v2:aes256gcm-det:g:h:i"
  prod = "enc:v2:aes256gcm-det:j:k:l"
}
`,
		);

		regenerateGeneratedForLockedFile(filePath);

		const generated = readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8");
		expect(generated).toContain("// @vars-platform: serverless");
		expect(generated).toContain("export async function getVars");
		expect(generated).toContain("INBOUND_EMAIL_DOMAIN");
		expect(generated).toContain('"dev": "in-dev.example.com"');
		expect(generated).toContain('"prod": "in.example.com"');
		expect(generated).toContain("ADDED: Redacted<string>");
	});

	it("preserves serverless output when hiding an unlocked file", async () => {
		generateForFile(filePath, "serverless");

		const unlockedPath = join(dir, "config.unlocked.vars");
		writeFileSync(
			unlockedPath,
			`env(dev, prod)

public APP_NAME = "demo"
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
ADDED_SECRET = "new"
`,
		);
		const key = await createMasterKey();

		await hideUnlockedFiles([unlockedPath], key, "master");

		const generated = readFileSync(filePath.replace(/\.vars$/, ".generated.ts"), "utf8");
		expect(generated).toContain("// @vars-platform: serverless");
		expect(generated).toContain("export async function getVars");
		expect(generated).toContain("ADDED_SECRET: Redacted<string>");
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

use "./missing.vars"

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

	it("continues encrypting remaining files when regeneration fails for one file", async () => {
		const key = await createMasterKey();
		const first = join(dir, "first.unlocked.vars");
		const second = join(dir, "second.unlocked.vars");
		writeFileSync(first, 'env(dev)\nSECRET = "one"\n');
		writeFileSync(second, 'env(dev)\nSECRET = "two"\n');
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const failures = await hideUnlockedFiles([first, second], key, "master", (lockedPath) => {
			if (lockedPath.endsWith("first.vars")) {
				throw new Error(`regeneration failed for ${lockedPath}: boom`);
			}
		});

		expect(failures).toBe(1);
		expect(existsSync(join(dir, "first.vars"))).toBe(true);
		expect(existsSync(join(dir, "second.vars"))).toBe(true);
		expect(existsSync(first)).toBe(false);
		expect(existsSync(second)).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("regeneration failed for"));
	});
});
