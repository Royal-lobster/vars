import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { varsPlugin } from "../index.js";

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

import { loadEnvx, generateTypes, parse } from "@vars/core";
import { existsSync, statSync, readFileSync, writeFileSync } from "node:fs";

const mockLoadEnvx = vi.mocked(loadEnvx);
const mockGenerateTypes = vi.mocked(generateTypes);
const mockParse = vi.mocked(parse);
const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe("varsPlugin", () => {
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

  it("returns a Vite plugin object with name 'vars'", () => {
    mockLoadEnvx.mockReturnValue({});
    const plugin = varsPlugin();
    expect(plugin.name).toBe("vars");
  });

  it("has a config hook that returns define replacements", () => {
    mockLoadEnvx.mockReturnValue({
      VITE_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
      DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
    });
    const plugin = varsPlugin();
    const configHook = plugin.config as () => { define: Record<string, string> };
    const result = configHook();
    expect(result.define["import.meta.env.VITE_API_URL"]).toBe(JSON.stringify("https://api.example.com"));
  });

  it("only exposes VITE_* vars via import.meta.env replacements", () => {
    mockLoadEnvx.mockReturnValue({
      VITE_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
      DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
    });
    const plugin = varsPlugin();
    const configHook = plugin.config as () => { define: Record<string, string> };
    const result = configHook();
    expect(result.define["import.meta.env.VITE_API_URL"]).toBeDefined();
    expect(result.define["import.meta.env.DATABASE_URL"]).toBeUndefined();
  });

  it("injects ALL vars into process.env for server-side access", () => {
    mockLoadEnvx.mockReturnValue({
      VITE_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
      DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
      PORT: 3000,
    });
    const plugin = varsPlugin();
    const configHook = plugin.config as () => unknown;
    configHook();
    expect(process.env.DATABASE_URL).toBe("postgres://localhost/db");
    expect(process.env.PORT).toBe("3000");
  });

  it("accepts VarsOptions and passes them to loadEnvx", () => {
    mockLoadEnvx.mockReturnValue({});
    const plugin = varsPlugin({
      envFile: "custom.vars",
      env: "staging",
      key: "test-key",
    });
    const configHook = plugin.config as () => unknown;
    configHook();
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.stringContaining("custom.vars"),
      expect.objectContaining({ env: "staging", key: "test-key" }),
    );
  });

  it("has configureServer hook for HMR on .vars change", () => {
    mockLoadEnvx.mockReturnValue({});
    const plugin = varsPlugin();
    expect(plugin.configureServer).toBeDefined();
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
    const plugin = varsPlugin();
    const configHook = plugin.config as () => unknown;
    configHook();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("handles non-VITE_ vars with primitive types correctly", () => {
    mockLoadEnvx.mockReturnValue({
      VITE_DEBUG: true,
      VITE_PORT: 8080,
      VITE_NAME: { valueOf: () => "app", toString: () => "[REDACTED]" },
    });
    const plugin = varsPlugin();
    const configHook = plugin.config as () => { define: Record<string, string> };
    const result = configHook();
    expect(result.define["import.meta.env.VITE_DEBUG"]).toBe("true");
    expect(result.define["import.meta.env.VITE_PORT"]).toBe("8080");
    expect(result.define["import.meta.env.VITE_NAME"]).toBe(JSON.stringify("app"));
  });
});
