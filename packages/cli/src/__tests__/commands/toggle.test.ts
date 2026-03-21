import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { toggleVarsFile } from "../../commands/toggle.js";

describe("vars toggle", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-toggle-test-"));
    key = randomBytes(32);
  });

  it("decrypts an encrypted file", () => {
    const encValue = encrypt("secret", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `KEY  z.string()\n  @dev = ${encValue}\n`,
    );

    const action = toggleVarsFile(join(tmpDir, ".vars"), key);
    expect(action).toBe("show");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("secret");
  });

  it("encrypts a decrypted file", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "KEY  z.string()\n  @dev = plaintext-secret\n",
    );

    const action = toggleVarsFile(join(tmpDir, ".vars"), key);
    expect(action).toBe("hide");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("enc:v1:aes256gcm:");
  });
});
