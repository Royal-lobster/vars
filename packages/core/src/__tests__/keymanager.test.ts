import { describe, expect, it } from "vitest";
import {
  createMasterKey,
  decryptMasterKey,
  encryptMasterKey,
  parseKeyFile,
} from "../keymanager.js";

describe("keymanager", () => {
  it("creates a 32-byte master key", async () => {
    const key = await createMasterKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("encrypts and decrypts master key with PIN", async () => {
    const masterKey = await createMasterKey();
    const pin = "1234";
    const encoded = await encryptMasterKey(masterKey, pin);
    expect(encoded).toMatch(/^pin:v1:aes256gcm:/);

    const decrypted = await decryptMasterKey(encoded, pin);
    expect(decrypted).toEqual(masterKey);
  });

  it("fails with wrong PIN", async () => {
    const masterKey = await createMasterKey();
    const encoded = await encryptMasterKey(masterKey, "1234");
    await expect(decryptMasterKey(encoded, "wrong")).rejects.toThrow();
  });

  it("parseKeyFile extracts components", async () => {
    const masterKey = await createMasterKey();
    const encoded = await encryptMasterKey(masterKey, "5678");
    const parsed = parseKeyFile(encoded);
    expect(parsed.version).toBe("v1");
    expect(parsed.algorithm).toBe("aes256gcm");
    expect(parsed.salt).toBeTruthy();
    expect(parsed.iv).toBeTruthy();
    expect(parsed.ciphertext).toBeTruthy();
    expect(parsed.tag).toBeTruthy();
  });

  it("produces different output for same key+pin (unique salt/iv)", async () => {
    const masterKey = await createMasterKey();
    const a = await encryptMasterKey(masterKey, "1234");
    const b = await encryptMasterKey(masterKey, "1234");
    expect(a).not.toBe(b);
  });
});
