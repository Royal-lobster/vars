import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { varsIntegration } from "../index.js";

// Mock @vars/core
vi.mock("@vars/core", () => ({
	loadVars: vi.fn(),
	generateTypes: vi.fn(),
	parse: vi.fn(),
	extractValue: vi.fn((value: unknown) => {
		if (value === null || value === undefined) return "";
		if (typeof value === "object" && typeof (value as { unwrap?: () => unknown }).unwrap === "function") {
			return String((value as { unwrap: () => unknown }).unwrap());
		}
		if (typeof value === "object" && typeof (value as { valueOf: () => unknown }).valueOf === "function") {
			const inner = (value as { valueOf: () => unknown }).valueOf();
			if (inner !== value) return String(inner);
		}
		return String(value);
	}),
	readKeyFile: vi.fn(),
	regenerateIfStale: vi.fn(),
}));

import { extractValue, loadVars, readKeyFile, regenerateIfStale } from "@vars/core";

const mockLoadVars = vi.mocked(loadVars);
const mockExtractValue = vi.mocked(extractValue);
const mockReadKeyFile = vi.mocked(readKeyFile);
const mockRegenerateIfStale = vi.mocked(regenerateIfStale);

describe("varsIntegration", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv };
		// Re-apply extractValue default implementation after clearAllMocks
		mockExtractValue.mockImplementation((value: unknown) => {
			if (value === null || value === undefined) return "";
			if (typeof value === "object" && typeof (value as { unwrap?: () => unknown }).unwrap === "function") {
				return String((value as { unwrap: () => unknown }).unwrap());
			}
			if (typeof value === "object" && typeof (value as { valueOf: () => unknown }).valueOf === "function") {
				const inner = (value as { valueOf: () => unknown }).valueOf();
				if (inner !== value) return String(inner);
			}
			return String(value);
		});
		mockReadKeyFile.mockReturnValue(undefined);
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
		mockLoadVars.mockReturnValue({});
		const integration = varsIntegration();
		expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
	});

	it("injects all vars into process.env during config:setup", () => {
		mockLoadVars.mockReturnValue({
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
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
		mockLoadVars.mockReturnValue({
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
			PUBLIC_API_URL: { unwrap: () => "https://api.example.com", toString: () => "<redacted>" },
			PUBLIC_APP_NAME: { unwrap: () => "MyApp", toString: () => "<redacted>" },
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
		mockLoadVars.mockReturnValue({
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
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

	it("accepts VarsOptions and passes them to loadVars", () => {
		mockLoadVars.mockReturnValue({});
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
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.stringContaining("custom.vars"),
			expect.objectContaining({ env: "staging", key: "test-key" }),
		);
	});

	it("calls regenerateIfStale during config:setup", () => {
		mockLoadVars.mockReturnValue({});
		const integration = varsIntegration();
		const setupHook = integration.hooks["astro:config:setup"] as (options: {
			config: Record<string, unknown>;
			updateConfig: (config: Record<string, unknown>) => void;
		}) => void;
		setupHook({ config: {}, updateConfig: vi.fn() });
		expect(mockRegenerateIfStale).toHaveBeenCalledWith(
			expect.stringContaining(".vars"),
			".vars",
		);
	});
});
