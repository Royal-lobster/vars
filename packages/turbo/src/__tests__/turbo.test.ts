import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAll, diffApps, discoverWorkspaceVarsFiles, genAll } from "../index.js";

// Mock @vars/core
vi.mock("@vars/core", () => ({
	loadVars: vi.fn(),
	generateTypes: vi.fn(),
	parse: vi.fn(),
	resolveExtends: vi.fn(),
}));

vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
	existsSync: vi.fn(),
	statSync: vi.fn(),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(),
}));

vi.mock("node:path", async () => {
	const actual = await vi.importActual<typeof import("node:path")>("node:path");
	return {
		...actual,
		resolve: actual.resolve,
		join: actual.join,
		dirname: actual.dirname,
		relative: actual.relative,
		basename: actual.basename,
	};
});

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { generateTypes, loadVars, parse } from "@vars/core";

const mockLoadVars = vi.mocked(loadVars);
const mockGenerateTypes = vi.mocked(generateTypes);
const mockParse = vi.mocked(parse);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockStatSync = vi.mocked(statSync);

describe("@vars/turbo", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync.mockReturnValue(false);
		mockReadFileSync.mockReturnValue("");
		mockParse.mockReturnValue({ variables: [], refines: [], extendsPath: null });
		mockGenerateTypes.mockReturnValue("// generated");
	});

	describe("discoverWorkspaceVarsFiles", () => {
		it("finds .vars files in root and workspace packages", () => {
			// Mock pnpm-workspace.yaml exists with packages: ["apps/*", "packages/*"]
			mockExistsSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("pnpm-workspace.yaml")) return true;
				if (p.endsWith(".vars")) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((path) => {
				if (String(path).endsWith("pnpm-workspace.yaml")) {
					return 'packages:\n  - "apps/*"\n  - "packages/*"';
				}
				return "";
			});
			mockReaddirSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("/apps"))
					return [{ name: "web", isDirectory: () => true }] as unknown as ReturnType<
						typeof readdirSync
					>;
				if (p.endsWith("/packages"))
					return [{ name: "core", isDirectory: () => true }] as unknown as ReturnType<
						typeof readdirSync
					>;
				return [] as unknown as ReturnType<typeof readdirSync>;
			});

			const files = discoverWorkspaceVarsFiles("/fake/root");
			expect(files.length).toBeGreaterThanOrEqual(1);
		});

		it("returns empty array when no pnpm-workspace.yaml found", () => {
			mockExistsSync.mockReturnValue(false);
			const files = discoverWorkspaceVarsFiles("/fake/root");
			expect(files).toEqual([]);
		});
	});

	describe("checkAll", () => {
		it("returns results for each discovered .vars file", () => {
			mockExistsSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("pnpm-workspace.yaml")) return true;
				if (p.endsWith(".vars")) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((path) => {
				if (String(path).endsWith("pnpm-workspace.yaml")) {
					return 'packages:\n  - "apps/*"';
				}
				return "";
			});
			mockReaddirSync.mockImplementation((path) => {
				if (String(path).endsWith("/apps")) {
					return [{ name: "web", isDirectory: () => true }] as unknown as ReturnType<
						typeof readdirSync
					>;
				}
				return [] as unknown as ReturnType<typeof readdirSync>;
			});
			mockLoadVars.mockReturnValue({ PORT: 3000 });

			const results = checkAll("/fake/root");
			expect(Array.isArray(results)).toBe(true);
			for (const result of results) {
				expect(result).toHaveProperty("file");
				expect(result).toHaveProperty("ok");
			}
		});

		it("catches validation errors and marks result as not ok", () => {
			mockExistsSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("pnpm-workspace.yaml")) return true;
				if (p === "/fake/root/.vars") return true;
				return false;
			});
			mockReadFileSync.mockImplementation((path) => {
				if (String(path).endsWith("pnpm-workspace.yaml")) {
					return "packages: []";
				}
				return "";
			});
			mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
			mockLoadVars.mockImplementation(() => {
				throw new Error("Validation failed");
			});

			const results = checkAll("/fake/root");
			const failed = results.find((r) => !r.ok);
			if (failed) {
				expect(failed.ok).toBe(false);
				expect(failed.error).toBeDefined();
			}
		});
	});

	describe("genAll", () => {
		it("generates types for each discovered .vars file", () => {
			mockExistsSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("pnpm-workspace.yaml")) return true;
				if (p.endsWith(".vars")) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((path) => {
				if (String(path).endsWith("pnpm-workspace.yaml")) {
					return 'packages:\n  - "apps/*"';
				}
				return "";
			});
			mockReaddirSync.mockImplementation((path) => {
				if (String(path).endsWith("/apps")) {
					return [{ name: "web", isDirectory: () => true }] as unknown as ReturnType<
						typeof readdirSync
					>;
				}
				return [] as unknown as ReturnType<typeof readdirSync>;
			});
			mockStatSync.mockReturnValue({ mtimeMs: 1000 } as ReturnType<typeof statSync>);

			const results = genAll("/fake/root");
			expect(Array.isArray(results)).toBe(true);
			for (const result of results) {
				expect(result).toHaveProperty("file");
				expect(result).toHaveProperty("generated");
			}
		});

		it("writes env.generated.ts next to each .vars file", () => {
			mockExistsSync.mockImplementation((path) => {
				const p = String(path);
				if (p.endsWith("pnpm-workspace.yaml")) return true;
				if (p === "/fake/root/.vars") return true;
				return false;
			});
			mockReadFileSync.mockImplementation((path) => {
				if (String(path).endsWith("pnpm-workspace.yaml")) {
					return "packages: []";
				}
				return "";
			});
			mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
			mockStatSync.mockReturnValue({ mtimeMs: 1000 } as ReturnType<typeof statSync>);

			genAll("/fake/root");
			expect(mockWriteFileSync).toHaveBeenCalled();
		});
	});

	describe("diffApps", () => {
		it("returns variables present in one app but not the other", () => {
			const parsedA = {
				variables: [
					{ name: "DATABASE_URL", schema: "z.string().url()", values: [], metadata: {}, line: 1 },
					{ name: "PORT", schema: "z.number()", values: [], metadata: {}, line: 2 },
				],
				refines: [],
				extendsPath: null,
			};
			const parsedB = {
				variables: [
					{ name: "DATABASE_URL", schema: "z.string().url()", values: [], metadata: {}, line: 1 },
					{ name: "REDIS_URL", schema: "z.string().url()", values: [], metadata: {}, line: 2 },
				],
				refines: [],
				extendsPath: null,
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValueOnce("file-a-content").mockReturnValueOnce("file-b-content");
			mockParse.mockReturnValueOnce(parsedA).mockReturnValueOnce(parsedB);

			const diff = diffApps("/fake/apps/web/.vars", "/fake/apps/api/.vars");
			expect(diff.onlyInA).toContain("PORT");
			expect(diff.onlyInB).toContain("REDIS_URL");
			expect(diff.shared).toContain("DATABASE_URL");
		});

		it("returns empty arrays when both apps have same variables", () => {
			const parsed = {
				variables: [{ name: "PORT", schema: "z.number()", values: [], metadata: {}, line: 1 }],
				refines: [],
				extendsPath: null,
			};

			mockExistsSync.mockReturnValue(true);
			mockReadFileSync.mockReturnValue("content");
			mockParse.mockReturnValue(parsed);

			const diff = diffApps("/fake/apps/web/.vars", "/fake/apps/api/.vars");
			expect(diff.onlyInA).toEqual([]);
			expect(diff.onlyInB).toEqual([]);
			expect(diff.shared).toEqual(["PORT"]);
		});
	});
});
