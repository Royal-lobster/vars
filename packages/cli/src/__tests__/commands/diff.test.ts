import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { diffEnvironments } from "../../commands/diff.js";

describe("vars diff", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-diff-test-"));
  });

  it("shows variables that differ between envs", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @dev  = 3000",
        "  @prod = 8080",
        "",
        "HOST  z.string()",
        "  @default = localhost",
        "",
        "SECRET  z.string()",
        "  @dev  = dev-secret",
        "  @prod = prod-secret",
      ].join("\n"),
    );

    const diff = diffEnvironments(join(tmpDir, ".vars"), "dev", "prod");

    expect(diff.same).toContain("HOST");
    expect(diff.different.map((d) => d.variable)).toContain("PORT");
    expect(diff.different.map((d) => d.variable)).toContain("SECRET");
  });

  it("identifies missing variables per env", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "DEV_ONLY  z.string()",
        "  @dev = value",
        "",
        "PROD_ONLY  z.string()",
        "  @prod = value",
      ].join("\n"),
    );

    const diff = diffEnvironments(join(tmpDir, ".vars"), "dev", "prod");
    expect(diff.onlyLeft).toContain("DEV_ONLY");
    expect(diff.onlyRight).toContain("PROD_ONLY");
  });
});
