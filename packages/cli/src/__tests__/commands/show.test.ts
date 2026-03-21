import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { showVarsFile } from "../../commands/show.js";

describe("vars show", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-show-test-"));
    key = randomBytes(32);
  });

  it("decrypts encrypted values in-place", () => {
    const encValue = encrypt("postgres://localhost:5432/db", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `DATABASE_URL  z.string().url()\n  @dev = ${encValue}\n`,
    );

    showVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("postgres://localhost:5432/db");
    expect(content).not.toContain("enc:v1:aes256gcm:");
  });

  it("leaves already-decrypted values unchanged", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @dev = 3000\n",
    );

    showVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("@dev = 3000");
  });

  it("preserves comments and structure", () => {
    const encValue = encrypt("secret", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `# Database\nAPI_KEY  z.string()\n  @dev = ${encValue}\n`,
    );

    showVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("# Database");
    expect(content).toContain("API_KEY  z.string()");
    expect(content).toContain("@dev = secret");
  });
});
