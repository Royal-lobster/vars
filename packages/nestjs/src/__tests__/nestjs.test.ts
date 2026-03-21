import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnvxModule, VARS } from "../index.js";

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

import { existsSync, readFileSync } from "node:fs";
import { loadEnvx } from "@vars/core";

const mockLoadEnvx = vi.mocked(loadEnvx);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe("@vars/nestjs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync.mockReturnValue(false);
		mockReadFileSync.mockReturnValue("");
	});

	describe("VARS token", () => {
		it("is a Symbol", () => {
			expect(typeof VARS).toBe("symbol");
		});

		it("has description 'VARS'", () => {
			expect(VARS.toString()).toContain("VARS");
		});
	});

	describe("EnvxModule", () => {
		it("has a forRoot static method", () => {
			expect(typeof EnvxModule.forRoot).toBe("function");
		});

		it("forRoot returns a DynamicModule with VARS provider", () => {
			mockLoadEnvx.mockReturnValue({
				DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
				PORT: 3000,
			});
			const dynamicModule = EnvxModule.forRoot();
			expect(dynamicModule.module).toBe(EnvxModule);
			expect(dynamicModule.providers).toBeDefined();
			expect(dynamicModule.exports).toBeDefined();
		});

		it("forRoot accepts VarsOptions", () => {
			mockLoadEnvx.mockReturnValue({});
			const dynamicModule = EnvxModule.forRoot({
				envFile: "custom.vars",
				env: "staging",
				key: "test-key",
			});
			expect(dynamicModule.module).toBe(EnvxModule);
			expect(mockLoadEnvx).toHaveBeenCalledWith(
				expect.stringContaining("custom.vars"),
				expect.objectContaining({ env: "staging", key: "test-key" }),
			);
		});

		it("forRoot creates a provider with VARS token", () => {
			mockLoadEnvx.mockReturnValue({ PORT: 3000 });
			const dynamicModule = EnvxModule.forRoot();
			const varsProvider = dynamicModule.providers?.find(
				(p: { provide?: symbol }) => p.provide === VARS,
			);
			expect(varsProvider).toBeDefined();
		});

		it("VARS provider value is the resolved env object", () => {
			const resolved = {
				DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
				PORT: 3000,
			};
			mockLoadEnvx.mockReturnValue(resolved);
			const dynamicModule = EnvxModule.forRoot();
			const varsProvider = dynamicModule.providers?.find(
				(p: { provide?: symbol }) => p.provide === VARS,
			) as { provide: symbol; useValue: Record<string, unknown> };
			expect(varsProvider.useValue).toBe(resolved);
		});

		it("forRoot exports the VARS provider for injection", () => {
			mockLoadEnvx.mockReturnValue({});
			const dynamicModule = EnvxModule.forRoot();
			expect(dynamicModule.exports).toContain(VARS);
		});

		it("marks module as global so VARS is available everywhere", () => {
			mockLoadEnvx.mockReturnValue({});
			const dynamicModule = EnvxModule.forRoot();
			expect(dynamicModule.global).toBe(true);
		});

		it("uses VARS_ENV and VARS_KEY from process.env as defaults", () => {
			const originalEnv = { ...process.env };
			process.env.VARS_ENV = "production";
			process.env.VARS_KEY = "env-key";
			mockLoadEnvx.mockReturnValue({});
			EnvxModule.forRoot();
			expect(mockLoadEnvx).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ env: "production", key: "env-key" }),
			);
			process.env = originalEnv;
		});
	});
});
