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

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
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

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("round-trips: show then hide preserves decrypted values", async () => {
    const { showVarsFile } = await import("../../commands/show.js");
    const original = "super-secret-value";
    const encValue = encrypt(original, key);

    writeFileSync(
      join(tmpDir, ".vars"),
      `SECRET  z.string()\n  @dev = ${encValue}\n`,
    );

    showVarsFile(join(tmpDir, ".vars"), key);
    const shown = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(shown).toContain(original);

    hideVarsFile(join(tmpDir, ".vars"), key);
    const hidden = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(hidden).not.toContain(original);
    expect(hidden).toContain("enc:v1:aes256gcm:");
  });
});
