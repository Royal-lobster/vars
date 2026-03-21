import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { buildRunEnv } from "../../commands/run.js";

describe("vars run", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-run-test-"));
    key = randomBytes(32);
  });

  it("builds env object from plaintext .vars", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "",
        "HOST  z.string()",
        "  @default = localhost",
      ].join("\n"),
    );

    const env = buildRunEnv(join(tmpDir, ".vars"), "dev", key);
    expect(env.PORT).toBe("3000");
    expect(env.HOST).toBe("localhost");
  });

  it("decrypts encrypted values", () => {
    const encPort = encrypt("8080", key);
    const encHost = encrypt("prod.example.com", key);

    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        `  @prod = ${encPort}`,
        "",
        "HOST  z.string()",
        `  @prod = ${encHost}`,
      ].join("\n"),
    );

    const env = buildRunEnv(join(tmpDir, ".vars"), "prod", key);
    expect(env.PORT).toBe("8080");
    expect(env.HOST).toBe("prod.example.com");
  });

  it("resolves env-specific values with default fallback", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "  @prod    = 8080",
      ].join("\n"),
    );

    expect(buildRunEnv(join(tmpDir, ".vars"), "dev", key).PORT).toBe("3000");
    expect(buildRunEnv(join(tmpDir, ".vars"), "prod", key).PORT).toBe("8080");
  });

  it("omits undefined optional values", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "OPTIONAL  z.string().optional()",
        "  @prod = prod-only",
      ].join("\n"),
    );

    const env = buildRunEnv(join(tmpDir, ".vars"), "dev", key);
    expect(env.OPTIONAL).toBeUndefined();
  });
});
