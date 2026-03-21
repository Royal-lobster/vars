import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { generateTemplate } from "../../commands/template.js";

describe("vars template", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-template-test-"));
    key = randomBytes(32);
  });

  it("generates a .env-style template from plaintext .vars", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @default = 3000",
        "  @prod    = 8080",
        "",
        "HOST  z.string()",
        "  @default = localhost",
      ].join("\n"),
    );

    const result = generateTemplate(join(tmpDir, ".vars"), "dev", null);
    expect(result).toContain("PORT=3000");
    expect(result).toContain("HOST=localhost");
  });

  it("decrypts encrypted values when key is provided", () => {
    const encPort = encrypt("8080", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `PORT  z.coerce.number()\n  @prod = ${encPort}\n`,
    );

    const result = generateTemplate(join(tmpDir, ".vars"), "prod", key);
    expect(result).toContain("PORT=8080");
  });

  it("uses @default when specific env not found", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    const result = generateTemplate(join(tmpDir, ".vars"), "staging", null);
    expect(result).toContain("PORT=3000");
  });

  it("omits variables with no value for the given env", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PROD_ONLY  z.string()\n  @prod = value\n",
    );

    const result = generateTemplate(join(tmpDir, ".vars"), "dev", null);
    expect(result).not.toContain("PROD_ONLY");
  });
});
