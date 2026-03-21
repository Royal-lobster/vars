import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "../crypto.js";
import { loadEnvx, Redacted } from "../index.js";

describe("loadEnvx", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-test-"));
    key = randomBytes(32);
  });

  function writeVarsFile(content: string) {
    writeFileSync(join(tmpDir, ".vars"), content);
  }

  it("loads and validates a simple .vars file with plaintext values", () => {
    writeVarsFile([
      "PORT  z.coerce.number().int().min(1024)",
      "  @default = 3000",
      "",
      "HOST  z.string()",
      "  @default = localhost",
    ].join("\n"));

    const config = loadEnvx(join(tmpDir, ".vars"), {
      env: "dev",
      key,
    });

    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBeInstanceOf(Redacted);
    expect(config.HOST.unwrap()).toBe("localhost");
  });

  it("loads encrypted values", () => {
    const encPort = encrypt("8080", key);
    const encHost = encrypt("prod.example.com", key);

    writeVarsFile([
      "PORT  z.coerce.number()",
      `  @default = ${encPort}`,
      "",
      "HOST  z.string()",
      `  @default = ${encHost}`,
    ].join("\n"));

    const config = loadEnvx(join(tmpDir, ".vars"), {
      env: "prod",
      key,
    });

    expect(config.PORT).toBe(8080);
    expect(config.HOST.unwrap()).toBe("prod.example.com");
  });

  it("wraps string values in Redacted, leaves numbers/booleans plain", () => {
    writeVarsFile([
      "SECRET  z.string()",
      "  @default = my-secret",
      "",
      "PORT  z.coerce.number()",
      "  @default = 3000",
      "",
      "DEBUG  z.coerce.boolean()",
      "  @default = true",
    ].join("\n"));

    const config = loadEnvx(join(tmpDir, ".vars"), { env: "dev", key });

    expect(config.SECRET).toBeInstanceOf(Redacted);
    expect(typeof config.PORT).toBe("number");
    expect(typeof config.DEBUG).toBe("boolean");
  });

  it("throws ValidationError when required value is missing", () => {
    writeVarsFile([
      "REQUIRED  z.string()",
      "  @dev = only-dev",
    ].join("\n"));

    expect(() =>
      loadEnvx(join(tmpDir, ".vars"), { env: "prod", key }),
    ).toThrow();
  });

  it("throws ValidationError when value fails schema", () => {
    writeVarsFile([
      "PORT  z.coerce.number().int().min(1024)",
      "  @default = 80",
    ].join("\n"));

    expect(() =>
      loadEnvx(join(tmpDir, ".vars"), { env: "dev", key }),
    ).toThrow();
  });

  it("applies @refine cross-variable constraints", () => {
    // Note: z.coerce.boolean() coerces any non-empty string to true,
    // so we use z.coerce.number() with 0/1 to test refine constraints
    writeVarsFile([
      "LOG_LEVEL  z.enum([\"debug\", \"info\"])",
      "  @default = debug",
      "",
      "DEBUG  z.coerce.number()",
      "  @default = 0",
      "",
      '@refine (env) => env.LOG_LEVEL !== "debug" || env.DEBUG === 1',
      '  "DEBUG must be 1 when LOG_LEVEL is debug"',
    ].join("\n"));

    expect(() =>
      loadEnvx(join(tmpDir, ".vars"), { env: "dev", key }),
    ).toThrow("DEBUG must be 1");
  });

  it("defaults env to development", () => {
    writeVarsFile([
      "PORT  z.coerce.number()",
      "  @default = 3000",
    ].join("\n"));

    const config = loadEnvx(join(tmpDir, ".vars"), { key });
    expect(config.PORT).toBe(3000);
  });
});
