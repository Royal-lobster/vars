import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectGeneratedPlatform, generateForFile, resolvePlatformArg } from "../commands/gen.js";

function makeTmpDir(): string {
	const dir = join(tmpdir(), `vars-gen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return realpathSync(dir);
}

const FIXTURE = `env(dev, prod)

public APP_NAME = "demo"
SECRET : z.string() {
  dev = "enc:v2:aes256gcm-det:a:b:c"
  prod = "enc:v2:aes256gcm-det:d:e:f"
}
`;

describe("generateForFile — serverless platform", () => {
	let tmp: string;
	let filePath: string;

	beforeEach(() => {
		tmp = makeTmpDir();
		filePath = join(tmp, "config.vars");
		writeFileSync(filePath, FIXTURE);
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	it("writes a serverless bundle containing CIPHERTEXTS, getVars, and PUBLIC_VARS", () => {
		generateForFile(filePath, "serverless");
		const outPath = filePath.replace(/\.vars$/, ".generated.ts");
		const code = readFileSync(outPath, "utf8");
		expect(code).toContain("// @vars-platform: serverless");
		expect(code).toContain("CIPHERTEXTS");
		expect(code).toContain("export async function getVars");
		expect(code).toContain("PUBLIC_VARS");
	});
});

describe("resolvePlatformArg", () => {
	it("accepts --platform after the positional file", () => {
		expect(resolvePlatformArg("node", ["config.vars", "--platform", "serverless"])).toBe(
			"serverless",
		);
	});

	it("accepts --platform=value after the positional file", () => {
		expect(resolvePlatformArg("node", ["config.vars", "--platform=serverless"])).toBe("serverless");
	});
});

describe("detectGeneratedPlatform", () => {
	let tmp: string;
	let filePath: string;

	beforeEach(() => {
		tmp = makeTmpDir();
		filePath = join(tmp, "config.vars");
		writeFileSync(filePath, FIXTURE);
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	it("returns the platform marker from an existing generated file", () => {
		generateForFile(filePath, "serverless");
		expect(detectGeneratedPlatform(filePath)).toBe("serverless");
	});

	it("returns null when the generated file does not exist", () => {
		expect(detectGeneratedPlatform(filePath)).toBeNull();
	});
});

describe("generateForFile — cloudflare migration error", () => {
	let tmp: string;
	let filePath: string;

	beforeEach(() => {
		tmp = makeTmpDir();
		filePath = join(tmp, "config.vars");
		writeFileSync(filePath, FIXTURE);
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("prints a migration error and calls process.exit(1)", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
			throw new Error("exit");
		}) as never);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(() => generateForFile(filePath, "cloudflare")).toThrow("exit");

		expect(exitSpy).toHaveBeenCalledWith(1);
		const printed = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
		expect(printed).toContain("--platform cloudflare was removed");
		expect(printed).toContain("--platform serverless");
		expect(printed).toContain("https://vars.dev/docs/frameworks/cloudflare");
	});
});
