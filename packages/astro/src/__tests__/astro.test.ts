import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { varsIntegration } from "../index.js";

// Mock @vars/core
vi.mock("@vars/core", () => ({
	loadEnvx: vi.fn(),
	generateTypes: vi.fn(),
	parse: vi.fn(),
}));

vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
	existsSync: vi.fn(),
	statSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { generateTypes, loadEnvx, parse } from "@vars/core";

const mockLoadEnvx = vi.mocked(loadEnvx);
const mockGenerateTypes = vi.mocked(generateTypes);
const mockParse = vi.mocked(parse);
const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe("varsIntegration", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv };
		mockExistsSync.mockImplementation((path) => {
			if (String(path).endsWith(".vars")) return true;
			if (String(path).endsWith("env.generated.ts")) return false;
			if (String(path).endsWith(".vars.key")) return false;
			return false;
		});
		mockStatSync.mockReturnValue({ mtimeMs: 1000 } as ReturnType<typeof statSync>);
		mockReadFileSync.mockReturnValue("");
		mockParse.mockReturnValue({ variables: [], refines: [], extendsPath: null });
		mockGenerateTypes.mockReturnValue("// generated");
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("returns a valid Astro integration object", () => {
		const integration = varsIntegration();
		expect(integration.name).toBe("vars");
		expect(integration.hooks).toBeDefined();
		expect(integration.hooks["astro:config:setup"]).toBeDefined();
	});

	it("hooks into astro:config:setup", () => {
		mockLoadEnvx.mockReturnValue({});
		const integration = varsIntegration();
		expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
	});

	it("injects all vars into process.env during config:setup", () => {
		mockLoadEnvx.mockReturnValue({
			DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
			PORT: 3000,
		});
		const integration = varsIntegration();
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		const updateConfig = vi.fn();
		setupHook({ config: {}, updateConfig });
		expect(process.env.DATABASE_URL).toBe("postgres://localhost/db");
		expect(process.env.PORT).toBe("3000");
	});

	it("splits PUBLIC_* vars and adds them to Vite define for client", () => {
		mockLoadEnvx.mockReturnValue({
			DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
			PUBLIC_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
			PUBLIC_APP_NAME: { valueOf: () => "MyApp", toString: () => "[REDACTED]" },
		});
		const integration = varsIntegration();
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		const updateConfig = vi.fn();
		setupHook({ config: {}, updateConfig });
		expect(updateConfig).toHaveBeenCalledWith({
			vite: {
				define: {
					"import.meta.env.PUBLIC_API_URL": JSON.stringify("https://api.example.com"),
					"import.meta.env.PUBLIC_APP_NAME": JSON.stringify("MyApp"),
				},
			},
		});
	});

	it("does not call updateConfig when there are no PUBLIC_* vars", () => {
		mockLoadEnvx.mockReturnValue({
			DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
		});
		const integration = varsIntegration();
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		const updateConfig = vi.fn();
		setupHook({ config: {}, updateConfig });
		expect(updateConfig).not.toHaveBeenCalled();
	});

	it("accepts VarsOptions and passes them to loadEnvx", () => {
		mockLoadEnvx.mockReturnValue({});
		const integration = varsIntegration({
			envFile: "custom.vars",
			env: "staging",
			key: "test-key",
		});
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		setupHook({ config: {}, updateConfig: vi.fn() });
		expect(mockLoadEnvx).toHaveBeenCalledWith(
			expect.stringContaining("custom.vars"),
			expect.objectContaining({ env: "staging", key: "test-key" }),
		);
	});

	it("regenerates env.generated.ts when .vars is newer", () => {
		mockExistsSync.mockImplementation((path) => {
			if (String(path).endsWith(".vars")) return true;
			if (String(path).endsWith("env.generated.ts")) return true;
			return false;
		});
		mockStatSync.mockImplementation((path) => {
			if (String(path).endsWith(".vars")) return { mtimeMs: 2000 } as ReturnType<typeof statSync>;
			return { mtimeMs: 1000 } as ReturnType<typeof statSync>;
		});
		mockLoadEnvx.mockReturnValue({});
		const integration = varsIntegration();
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		setupHook({ config: {}, updateConfig: vi.fn() });
		expect(mockWriteFileSync).toHaveBeenCalled();
	});
});
