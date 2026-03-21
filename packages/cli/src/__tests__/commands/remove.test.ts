import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { removeVariable } from "../../commands/remove.js";

describe("vars remove", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-remove-test-"));
  });

  it("removes a variable and its values from .vars", () => {
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

    removeVariable(join(tmpDir, ".vars"), "PORT");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).not.toContain("PORT");
    expect(content).toContain("HOST");
  });

  it("throws if variable not found", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    expect(() => removeVariable(join(tmpDir, ".vars"), "NONEXISTENT")).toThrow(
      "not found",
    );
  });

  it("removes variable with metadata", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "API_KEY  z.string()",
        '  @description "API key"',
        "  @expires     2027-01-01",
        "  @dev = test-key",
        "",
        "PORT  z.coerce.number()",
        "  @default = 3000",
      ].join("\n"),
    );

    removeVariable(join(tmpDir, ".vars"), "API_KEY");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).not.toContain("API_KEY");
    expect(content).not.toContain("@description");
    expect(content).toContain("PORT");
  });
});
