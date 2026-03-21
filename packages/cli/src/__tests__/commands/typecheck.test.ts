import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { scanProcessEnvRefs } from "../../commands/typecheck.js";

describe("vars typecheck", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-typecheck-test-"));
  });

  it("finds process.env references in .ts files", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src", "app.ts"),
      `
        const port = process.env.PORT;
        const host = process.env.HOST;
        const secret = process.env.UNKNOWN_VAR;
      `,
    );

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

    const result = scanProcessEnvRefs(join(tmpDir, "src"), join(tmpDir, ".vars"));
    expect(result.defined).toContain("PORT");
    expect(result.defined).toContain("HOST");
    expect(result.undefined).toContain("UNKNOWN_VAR");
  });

  it("returns empty when no process.env references found", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(join(tmpDir, "src", "app.ts"), "const x = 1;\n");
    writeFileSync(join(tmpDir, ".vars"), "PORT  z.coerce.number()\n  @default = 3000\n");

    const result = scanProcessEnvRefs(join(tmpDir, "src"), join(tmpDir, ".vars"));
    expect(result.undefined).toHaveLength(0);
    expect(result.defined).toHaveLength(0);
  });

  it("handles import.meta.env references", () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      join(tmpDir, "src", "app.ts"),
      `const url = import.meta.env.VITE_API_URL;`,
    );
    writeFileSync(join(tmpDir, ".vars"), "");

    const result = scanProcessEnvRefs(join(tmpDir, "src"), join(tmpDir, ".vars"));
    expect(result.undefined).toContain("VITE_API_URL");
  });
});
