import { beforeEach, describe, expect, it, vi } from "vitest";
import { VarsModule, VARS } from "../index.js";

// Mock @vars/core
vi.mock("@vars/core", () => ({
	loadVars: vi.fn(),
	readKeyFile: vi.fn(),
}));

import { loadVars, readKeyFile } from "@vars/core";

const mockLoadVars = vi.mocked(loadVars);
const mockReadKeyFile = vi.mocked(readKeyFile);

describe("@vars/nestjs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadKeyFile.mockReturnValue(undefined);
	});

	describe("VARS token", () => {
		it("is a Symbol", () => {
			expect(typeof VARS).toBe("symbol");
		});

		it("has description 'VARS'", () => {
			expect(VARS.toString()).toContain("VARS");
		});
	});

	describe("VarsModule", () => {
		it("has a forRoot static method", () => {
			expect(typeof VarsModule.forRoot).toBe("function");
		});

		it("forRoot returns a DynamicModule with VARS provider", () => {
			mockLoadVars.mockReturnValue({
				DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
				PORT: 3000,
			});
			const dynamicModule = VarsModule.forRoot();
			expect(dynamicModule.module).toBe(VarsModule);
			expect(dynamicModule.providers).toBeDefined();
			expect(dynamicModule.exports).toBeDefined();
		});

		it("forRoot accepts VarsOptions", () => {
			mockLoadVars.mockReturnValue({});
			const dynamicModule = VarsModule.forRoot({
				envFile: "custom.vars",
				env: "staging",
				key: "test-key",
			});
			expect(dynamicModule.module).toBe(VarsModule);
			expect(mockLoadVars).toHaveBeenCalledWith(
				expect.stringContaining("custom.vars"),
				expect.objectContaining({ env: "staging", key: "test-key" }),
			);
		});

		it("forRoot creates a provider with VARS token", () => {
			mockLoadVars.mockReturnValue({ PORT: 3000 });
			const dynamicModule = VarsModule.forRoot();
			const varsProvider = dynamicModule.providers?.find(
				(p: { provide?: symbol }) => p.provide === VARS,
			);
			expect(varsProvider).toBeDefined();
		});

		it("VARS provider value is the resolved env object", () => {
			const resolved = {
				DATABASE_URL: { unwrap: () => "postgres://localhost/db", toString: () => "<redacted>" },
				PORT: 3000,
			};
			mockLoadVars.mockReturnValue(resolved);
			const dynamicModule = VarsModule.forRoot();
			const varsProvider = dynamicModule.providers?.find(
				(p: { provide?: symbol }) => p.provide === VARS,
			) as { provide: symbol; useValue: Record<string, unknown> };
			expect(varsProvider.useValue).toBe(resolved);
		});

		it("forRoot exports the VARS provider for injection", () => {
			mockLoadVars.mockReturnValue({});
			const dynamicModule = VarsModule.forRoot();
			expect(dynamicModule.exports).toContain(VARS);
		});

		it("marks module as global so VARS is available everywhere", () => {
			mockLoadVars.mockReturnValue({});
			const dynamicModule = VarsModule.forRoot();
			expect(dynamicModule.global).toBe(true);
		});

		it("uses VARS_ENV and VARS_KEY from process.env as defaults", () => {
			const originalEnv = { ...process.env };
			process.env.VARS_ENV = "production";
			process.env.VARS_KEY = "env-key";
			mockLoadVars.mockReturnValue({});
			VarsModule.forRoot();
			expect(mockLoadVars).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ env: "production", key: "env-key" }),
			);
			process.env = originalEnv;
		});

		it("reads key from .vars.key file via readKeyFile", () => {
			const originalEnv = { ...process.env };
			process.env.VARS_KEY = undefined;
			mockReadKeyFile.mockReturnValue("file-key-base64");
			mockLoadVars.mockReturnValue({});
			VarsModule.forRoot();
			expect(mockLoadVars).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ key: "file-key-base64" }),
			);
			process.env = originalEnv;
		});
	});
});
