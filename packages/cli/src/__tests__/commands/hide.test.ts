import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { hideVarsFile } from "../../commands/hide.js";

describe("vars hide", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-hide-test-"));
    key = randomBytes(32);
  });

  it("encrypts plaintext values in-place", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "API_KEY  z.string()\n  @dev = my-secret-key\n",
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    expect(content).toContain("enc:v1:aes256gcm:");
    expect(content).not.toContain("my-secret-key");
  });

  it("leaves already-encrypted values unchanged", () => {
    const original = "enc:v1:aes256gcm:dGVzdA==:Y2lwaGVy:dGFn";
    writeFileSync(
      join(tmpDir, ".vars"),
      `SECRET  z.string()\n  @dev = ${original}\n`,
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("round-trips: show then hide preserves decrypted values", async () => {
    const { showVarsFile } = await import("../../commands/show.js");
    const original = "super-secret-value";
    const encValue = encrypt(original, key);

    writeFileSync(
      join(tmpDir, "vault.vars"),
      `SECRET  z.string()\n  @dev = ${encValue}\n`,
    );

    showVarsFile(join(tmpDir, "vault.vars"), key);
    const shown = readFileSync(join(tmpDir, "unlocked.vars"), "utf8");
    expect(shown).toContain(original);

    hideVarsFile(join(tmpDir, "vault.vars"), key);
    const hidden = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    expect(hidden).not.toContain(original);
    expect(hidden).toContain("enc:v1:aes256gcm:");
  });

  it("skips encryption for @public variables", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @public",
        "  @dev     = 8080",
        "",
        "SECRET  z.string()",
        "  @dev     = my-secret",
      ].join("\n"),
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    // PORT should remain plaintext
    expect(content).toContain("8080");
    // SECRET should be encrypted
    expect(content).not.toContain("my-secret");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("encrypts values when @public is removed", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @dev     = 8080",
      ].join("\n"),
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    expect(content).not.toContain("8080");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("keeps encrypted value as-is when @public is added to already-encrypted var", () => {
    const encValue = encrypt("8080", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @public",
        `  @dev     = ${encValue}`,
      ].join("\n"),
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    // Value stays encrypted as-is (not double-encrypted, not decrypted)
    expect(content).toContain(encValue);
    expect(content).toContain("@public");
  });

  it("preserves @public metadata in output", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @public",
        "  @default = 3000",
      ].join("\n"),
    );

    hideVarsFile(join(tmpDir, ".vars"), key);

    const content = readFileSync(join(tmpDir, "vault.vars"), "utf8");
    expect(content).toContain("@public");
    expect(content).toContain("3000");
  });
});
