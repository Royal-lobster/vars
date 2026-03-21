import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { withEnvx } from "../index.js";

// Mock @vars/core
vi.mock("@vars/core", () => ({
  loadEnvx: vi.fn(),
  generateTypes: vi.fn(),
  parse: vi.fn(),
}));

// Mock node:fs for .vars file stat checks
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

describe("withEnvx", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Default: .vars exists, no generated file yet
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

  it("returns a valid Next.js config object", () => {
    mockLoadEnvx.mockReturnValue({});
    const config = withEnvx();
    expect(config).toBeDefined();
    expect(typeof config).toBe("object");
  });

  it("passes through existing Next.js config properties", () => {
    mockLoadEnvx.mockReturnValue({});
    const config = withEnvx({ reactStrictMode: true, images: { domains: ["example.com"] } });
    expect(config.reactStrictMode).toBe(true);
    expect(config.images).toEqual({ domains: ["example.com"] });
  });

  it("accepts VarsOptions and passes them to loadEnvx", () => {
    mockLoadEnvx.mockReturnValue({});
    withEnvx({ reactStrictMode: true }, {
      envFile: "custom.vars",
      env: "staging",
      key: "test-key-base64",
    });
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.stringContaining("custom.vars"),
      expect.objectContaining({
        env: "staging",
        key: "test-key-base64",
      }),
    );
  });

  it("injects resolved vars into process.env", () => {
    mockLoadEnvx.mockReturnValue({
      DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
      PORT: 3000,
      DEBUG: true,
    });
    withEnvx();
    expect(process.env.DATABASE_URL).toBe("postgres://localhost/db");
    expect(process.env.PORT).toBe("3000");
    expect(process.env.DEBUG).toBe("true");
  });

  it("splits NEXT_PUBLIC_* vars into env config for client bundle", () => {
    mockLoadEnvx.mockReturnValue({
      DATABASE_URL: { valueOf: () => "postgres://localhost/db", toString: () => "[REDACTED]" },
      NEXT_PUBLIC_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
      NEXT_PUBLIC_APP_NAME: { valueOf: () => "MyApp", toString: () => "[REDACTED]" },
    });
    const config = withEnvx();
    expect(config.env).toEqual({
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_APP_NAME: "MyApp",
    });
  });

  it("merges NEXT_PUBLIC_* env with existing env config", () => {
    mockLoadEnvx.mockReturnValue({
      NEXT_PUBLIC_API_URL: { valueOf: () => "https://api.example.com", toString: () => "[REDACTED]" },
    });
    const config = withEnvx({ env: { EXISTING: "value" } });
    expect(config.env).toEqual({
      EXISTING: "value",
      NEXT_PUBLIC_API_URL: "https://api.example.com",
    });
  });

  it("uses VARS_ENV from process.env when env option not provided", () => {
    process.env.VARS_ENV = "production";
    mockLoadEnvx.mockReturnValue({});
    withEnvx();
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ env: "production" }),
    );
  });

  it("defaults to 'development' when no env specified", () => {
    delete process.env.VARS_ENV;
    mockLoadEnvx.mockReturnValue({});
    withEnvx();
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ env: "development" }),
    );
  });

  it("uses VARS_KEY from process.env when key option not provided", () => {
    process.env.VARS_KEY = "env-key-base64";
    mockLoadEnvx.mockReturnValue({});
    withEnvx();
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ key: "env-key-base64" }),
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
    withEnvx();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it("skips codegen when env.generated.ts is up to date", () => {
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith(".vars")) return true;
      if (String(path).endsWith("env.generated.ts")) return true;
      return false;
    });
    mockStatSync.mockImplementation((path) => {
      if (String(path).endsWith(".vars")) return { mtimeMs: 1000 } as ReturnType<typeof statSync>;
      return { mtimeMs: 2000 } as ReturnType<typeof statSync>;
    });
    mockLoadEnvx.mockReturnValue({});
    withEnvx();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("reads key from .vars.key file when no key in env or options", () => {
    delete process.env.VARS_KEY;
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith(".vars")) return true;
      if (String(path).endsWith(".vars.key")) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).toString().endsWith(".vars.key")) return "file-key-base64\n";
      return "";
    });
    mockLoadEnvx.mockReturnValue({});
    withEnvx();
    expect(mockLoadEnvx).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ key: "file-key-base64" }),
    );
  });

  it("extracts Redacted values using valueOf() for process.env injection", () => {
    const redactedValue = {
      valueOf: () => "secret-value",
      toString: () => "[REDACTED]",
      [Symbol.toPrimitive]: (hint: string) => hint === "string" ? "[REDACTED]" : "secret-value",
    };
    mockLoadEnvx.mockReturnValue({ SECRET: redactedValue });
    withEnvx();
    expect(process.env.SECRET).toBe("secret-value");
  });
});
