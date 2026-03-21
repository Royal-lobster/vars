import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { checkVarsFile } from "../../commands/check.js";

describe("vars check", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-check-test-"));
  });

  it("returns success for valid plaintext .vars", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number().int().min(1024)",
        "  @default = 3000",
        "",
        "HOST  z.string()",
        "  @default = localhost",
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors for invalid values", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number().int().min(1024)",
        "  @default = 80",
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].variable).toBe("PORT");
  });

  it("returns errors for missing required values", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "REQUIRED_KEY  z.string()",
        "  @prod = prod-only-value",
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Missing");
  });

  it("returns warnings for expired secrets", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "OLD_KEY  z.string()",
        "  @expires     2020-01-01",
        "  @default = some-value",
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain("expired");
  });

  it("returns warnings for deprecated variables", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "OLD_TOKEN  z.string()",
        '  @deprecated "Use NEW_TOKEN instead"',
        "  @default = old-value",
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain("Deprecated");
  });

  it("validates @refine constraints", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        'LOG_LEVEL  z.enum(["debug", "info"])',
        "  @default = debug",
        "",
        "MAX_RETRIES  z.coerce.number()",
        "  @default = 0",
        "",
        '@refine (env) => env.LOG_LEVEL !== "debug" || env.MAX_RETRIES > 0',
        '  "MAX_RETRIES must be > 0 when LOG_LEVEL is debug"',
      ].join("\n"),
    );

    const result = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("MAX_RETRIES must be > 0"))).toBe(true);
  });
});
