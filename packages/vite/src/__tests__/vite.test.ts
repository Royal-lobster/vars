import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { varsPlugin } from "../index.js";

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

describe("varsPlugin", () => {
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

	it("returns a Vite plugin object with name 'vars'", () => {
		mockLoadVars.mockReturnValue({});
		const plugin = varsPlugin();
		expect(plugin.name).toBe("vars");
	});

	it("has a config hook that returns define replacements", () => {
		mockLoadVars.mockReturnValue({
			VITE_API_URL: { unwrap: () => "https://api.example.com", toString: () => "<redacted>" },
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
		});
		const plugin = varsPlugin();
		const configHook = plugin.config as () => { define: Record<string, string> };
		const result = configHook();
		expect(result.define["import.meta.env.VITE_API_URL"]).toBe(
			JSON.stringify("https://api.example.com"),
		);
	});

	it("only exposes VITE_* vars via import.meta.env replacements", () => {
		mockLoadVars.mockReturnValue({
			VITE_API_URL: { unwrap: () => "https://api.example.com", toString: () => "<redacted>" },
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
		});
		const plugin = varsPlugin();
		const configHook = plugin.config as () => { define: Record<string, string> };
		const result = configHook();
		expect(result.define["import.meta.env.VITE_API_URL"]).toBeDefined();
		expect(result.define["import.meta.env.DATABASE_URL"]).toBeUndefined();
	});

	it("injects ALL vars into process.env for server-side access", () => {
		mockLoadVars.mockReturnValue({
			VITE_API_URL: { unwrap: () => "https://api.example.com", toString: () => "<redacted>" },
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
			PORT: 3000,
		});
		const plugin = varsPlugin();
		const configHook = plugin.config as () => unknown;
		configHook();
		expect(process.env.DATABASE_URL).toBe("postgres://localhost/db");
		expect(process.env.PORT).toBe("3000");
	});

	it("accepts VarsOptions and passes them to loadVars", () => {
		mockLoadVars.mockReturnValue({});
		const plugin = varsPlugin({
			envFile: "custom.vars",
			env: "staging",
			key: "test-key",
		});
		const configHook = plugin.config as () => unknown;
		configHook();
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.stringContaining("custom.vars"),
			expect.objectContaining({ env: "staging", key: "test-key" }),
		);
	});

	it("has configureServer hook for HMR on .vars change", () => {
		mockLoadVars.mockReturnValue({});
		const plugin = varsPlugin();
		expect(plugin.configureServer).toBeDefined();
	});

	it("calls regenerateIfStale during config", () => {
		mockLoadVars.mockReturnValue({});
		const plugin = varsPlugin();
		const configHook = plugin.config as () => unknown;
		configHook();
		expect(mockRegenerateIfStale).toHaveBeenCalledWith(
			expect.stringContaining(".vars"),
			".vars",
		);
	});

	it("handles non-VITE_ vars with primitive types correctly", () => {
		mockLoadVars.mockReturnValue({
			VITE_DEBUG: true,
			VITE_PORT: 8080,
			VITE_NAME: { unwrap: () => "app", toString: () => "<redacted>" },
		});
		const plugin = varsPlugin();
		const configHook = plugin.config as () => { define: Record<string, string> };
		const result = configHook();
		expect(result.define["import.meta.env.VITE_DEBUG"]).toBe("true");
		expect(result.define["import.meta.env.VITE_PORT"]).toBe("8080");
		expect(result.define["import.meta.env.VITE_NAME"]).toBe(JSON.stringify("app"));
	});
});
