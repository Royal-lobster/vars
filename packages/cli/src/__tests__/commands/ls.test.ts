import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { listVariables } from "../../commands/ls.js";

describe("vars ls", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-ls-test-"));
  });

  it("lists all variables with their environments", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "  @prod    = 8080",
        "",
        "HOST  z.string()",
        "  @default = localhost",
        "",
        "OPTIONAL  z.string().optional()",
        "  @prod = only-prod",
      ].join("\n"),
    );

    const list = listVariables(join(tmpDir, ".vars"));
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe("PORT");
    expect(list[0].envs).toEqual(["default", "prod"]);
    expect(list[0].required).toBe(true);
    expect(list[2].name).toBe("OPTIONAL");
    expect(list[2].required).toBe(false);
  });

  it("includes metadata in listing", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "API_KEY  z.string()",
        '  @description "Main API key"',
        '  @deprecated "Use NEW_KEY"',
        "  @dev = test",
      ].join("\n"),
    );

    const list = listVariables(join(tmpDir, ".vars"));
    expect(list[0].description).toBe("Main API key");
    expect(list[0].deprecated).toBe("Use NEW_KEY");
  });
});
