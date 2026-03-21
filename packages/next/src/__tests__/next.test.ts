import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withVars } from "../index.js";

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

describe("withVars", () => {
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

	it("returns a valid Next.js config object", () => {
		mockLoadVars.mockReturnValue({});
		const config = withVars();
		expect(config).toBeDefined();
		expect(typeof config).toBe("object");
	});

	it("passes through existing Next.js config properties", () => {
		mockLoadVars.mockReturnValue({});
		const config = withVars({ reactStrictMode: true, images: { domains: ["example.com"] } });
		expect(config.reactStrictMode).toBe(true);
		expect(config.images).toEqual({ domains: ["example.com"] });
	});

	it("accepts VarsOptions and passes them to loadVars", () => {
		mockLoadVars.mockReturnValue({});
		withVars(
			{ reactStrictMode: true },
			{
				envFile: "custom.vars",
				env: "staging",
				key: "test-key-base64",
			},
		);
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.stringContaining("custom.vars"),
			expect.objectContaining({
				env: "staging",
				key: "test-key-base64",
			}),
		);
	});

	it("injects resolved vars into process.env", () => {
		mockLoadVars.mockReturnValue({
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
			PORT: 3000,
			DEBUG: true,
		});
		withVars();
		expect(process.env.DATABASE_URL).toBe("postgres://localhost/db");
		expect(process.env.PORT).toBe("3000");
		expect(process.env.DEBUG).toBe("true");
	});

	it("splits NEXT_PUBLIC_* vars into env config for client bundle", () => {
		mockLoadVars.mockReturnValue({
			DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
			NEXT_PUBLIC_API_URL: {
				unwrap: () => "https://api.example.com",
				toString: () => "<redacted>",
			},
			NEXT_PUBLIC_APP_NAME: { unwrap: () => "MyApp", toString: () => "<redacted>" },
		});
		const config = withVars();
		expect(config.env).toEqual({
			NEXT_PUBLIC_API_URL: "https://api.example.com",
			NEXT_PUBLIC_APP_NAME: "MyApp",
		});
	});

	it("merges NEXT_PUBLIC_* env with existing env config", () => {
		mockLoadVars.mockReturnValue({
			NEXT_PUBLIC_API_URL: {
				unwrap: () => "https://api.example.com",
				toString: () => "<redacted>",
			},
		});
		const config = withVars({ env: { EXISTING: "value" } });
		expect(config.env).toEqual({
			EXISTING: "value",
			NEXT_PUBLIC_API_URL: "https://api.example.com",
		});
	});

	it("uses VARS_ENV from process.env when env option not provided", () => {
		process.env.VARS_ENV = "production";
		mockLoadVars.mockReturnValue({});
		withVars();
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ env: "production" }),
		);
	});

	it("defaults to 'development' when no env specified", () => {
		process.env.VARS_ENV = undefined;
		mockLoadVars.mockReturnValue({});
		withVars();
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ env: "development" }),
		);
	});

	it("uses VARS_KEY from process.env when key option not provided", () => {
		process.env.VARS_KEY = "env-key-base64";
		mockLoadVars.mockReturnValue({});
		withVars();
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ key: "env-key-base64" }),
		);
	});

	it("calls regenerateIfStale with correct paths", () => {
		mockLoadVars.mockReturnValue({});
		withVars();
		expect(mockRegenerateIfStale).toHaveBeenCalledWith(
			expect.stringContaining(".vars"),
			".vars",
		);
	});

	it("reads key from .vars.key file via readKeyFile when no key in env or options", () => {
		process.env.VARS_KEY = undefined;
		mockReadKeyFile.mockReturnValue("file-key-base64");
		mockLoadVars.mockReturnValue({});
		withVars();
		expect(mockLoadVars).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ key: "file-key-base64" }),
		);
	});

	it("extracts Redacted values using unwrap() for process.env injection", () => {
		const redactedValue = {
			unwrap: () => "secret-value",
			toString: () => "<redacted>",
		};
		mockLoadVars.mockReturnValue({ SECRET: redactedValue });
		withVars();
		expect(process.env.SECRET).toBe("secret-value");
	});
});
