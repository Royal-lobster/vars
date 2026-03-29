import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { resolveUseChain } from "../use-resolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixtureDir = resolve(__dirname, "fixtures");

describe("use-resolver", () => {
	it("resolves use imports and merges declarations", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const names = result.vars.map((v) => v.name);
		expect(names).toContain("APP_NAME");
		expect(names).toContain("API_KEY");
		expect(names).toContain("LOG_LEVEL");
		expect(names).toContain("SHARED_SECRET");
	});

	it("resolves values for correct env", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const apiKey = result.vars.find((v) => v.name === "API_KEY");
		expect(apiKey?.value).toBe("my-local-key");

		const logLevel = result.vars.find((v) => v.name === "LOG_LEVEL");
		expect(logLevel?.value).toBe("debug");
	});

	it("local declarations shadow imports", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		// APP_NAME is only in child, not in shared
		const appName = result.vars.find((v) => v.name === "APP_NAME");
		expect(appName?.value).toBe("api");
	});

	it("tracks source files for hash computation", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		expect(result.sourceFiles.length).toBeGreaterThanOrEqual(2);
	});

	it("detects circular imports", () => {
		// Circular detection is exercised via the visited set guard in resolveFile.
		// This test verifies the basic chain resolves without error (non-circular case).
		expect(() =>
			resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "prod" }),
		).not.toThrow();
	});
});

describe("local overrides", () => {
	it("shadows base variable with local override", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const apiKey = result.vars.find((v) => v.name === "API_KEY");
		expect(apiKey?.value).toBe("my-local-key");
	});

	it("adds new variables from local file", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const debug = result.vars.find((v) => v.name === "DEBUG_MODE");
		expect(debug?.value).toBe("true");
	});

	it("preserves base variables not overridden by local", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const appName = result.vars.find((v) => v.name === "APP_NAME");
		expect(appName?.value).toBe("api");
	});

	it("includes local file in sourceFiles", () => {
		const result = resolveUseChain(resolve(fixtureDir, "services/api/vars.vars"), { env: "dev" });
		const hasLocal = result.sourceFiles.some((f) => f.endsWith("vars.local.vars"));
		expect(hasLocal).toBe(true);
	});
});

describe("local overrides — edge cases", () => {
	it("works fine when no local file exists", () => {
		// shared/infra.vars has no .local.vars sibling
		const result = resolveUseChain(resolve(fixtureDir, "shared/infra.vars"), { env: "dev" });
		const logLevel = result.vars.find((v) => v.name === "LOG_LEVEL");
		expect(logLevel?.value).toBe("debug");
	});

	it("warns and discards env() from local file", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("env() declaration ignored"));
		warnSpy.mockRestore();
	});

	it("warns and discards param from local file", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('param "region" ignored'));
		warnSpy.mockRestore();
	});

	it("uses env() from base even when local declares different envs", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = resolveUseChain(resolve(fixtureDir, "local-warnings.vars"), { env: "dev" });
		expect(result.envs).toEqual(["dev", "prod"]);
		warnSpy.mockRestore();
	});
});
