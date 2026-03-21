import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { calculateCoverage } from "../../commands/coverage.js";

describe("vars coverage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-coverage-test-"));
  });

  it("calculates 100% coverage when all vars have values", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @dev  = 3000",
        "  @prod = 8080",
        "",
        "HOST  z.string()",
        "  @dev  = localhost",
        "  @prod = prod.example.com",
      ].join("\n"),
    );

    const result = calculateCoverage(join(tmpDir, ".vars"), "dev");
    expect(result.percentage).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("calculates partial coverage for missing values", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @dev = 3000",
        "",
        "SECRET  z.string()",
        "  @prod = secret-value",
      ].join("\n"),
    );

    const result = calculateCoverage(join(tmpDir, ".vars"), "dev");
    expect(result.percentage).toBe(50);
    expect(result.missing).toContain("SECRET");
  });

  it("treats @default as covering all envs", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    const result = calculateCoverage(join(tmpDir, ".vars"), "prod");
    expect(result.percentage).toBe(100);
  });

  it("excludes optional variables from required coverage", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "",
        "OPTIONAL  z.string().optional()",
      ].join("\n"),
    );

    const result = calculateCoverage(join(tmpDir, ".vars"), "dev");
    expect(result.percentage).toBe(100);
  });
});
