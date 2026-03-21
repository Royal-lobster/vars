import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import {
  encrypt,
  decrypt,
  createMasterKey,
  encryptMasterKey,
  decryptMasterKey,
} from "@vars/core";
import { rotateKey } from "../../commands/rotate.js";

describe("vars rotate", () => {
  let tmpDir: string;
  let oldKey: Buffer;
  let oldPin: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-rotate-test-"));
    oldKey = await createMasterKey();
    oldPin = "1234";

    const encryptedKey = await encryptMasterKey(oldKey, oldPin);
    writeFileSync(join(tmpDir, ".vars.key"), encryptedKey);

    const encValue = encrypt("my-secret-value", oldKey);
    writeFileSync(
      join(tmpDir, ".vars"),
      `SECRET  z.string()\n  @dev = ${encValue}\n`,
    );
  });

  it("re-encrypts all values with a new key", async () => {
    const newPin = "5678";
    const { newKey } = await rotateKey(tmpDir, oldPin, newPin);

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("enc:v1:aes256gcm:");

    const match = content.match(/enc:v1:aes256gcm:[^\s]+/);
    expect(match).toBeTruthy();
    const decrypted = decrypt(match![0], newKey);
    expect(decrypted).toBe("my-secret-value");
  });

  it("updates .vars.key with new PIN-encrypted key", async () => {
    const newPin = "5678";
    const { newKey } = await rotateKey(tmpDir, oldPin, newPin);

    const keyContent = readFileSync(join(tmpDir, ".vars.key"), "utf8").trim();
    expect(keyContent).toMatch(/^pin:v1:aes256gcm:/);

    const recoveredKey = await decryptMasterKey(keyContent, newPin);
    expect(recoveredKey).toEqual(newKey);
  });

  it("fails with wrong old PIN", async () => {
    await expect(rotateKey(tmpDir, "wrong", "5678")).rejects.toThrow();
  });
});
