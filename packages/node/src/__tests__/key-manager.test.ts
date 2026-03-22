import { describe, it, expect } from "vitest";
import { createMasterKey, encryptMasterKey, decryptMasterKey, getKeyFromEnv } from "../key-manager.js";

describe("key-manager", () => {
  it("creates 32-byte key", async () => {
    const key = await createMasterKey();
    expect(key.length).toBe(32);
  });

  it("PIN encrypt/decrypt roundtrip", async () => {
    const key = await createMasterKey();
    const encrypted = await encryptMasterKey(key, "my-pin-1234");
    expect(encrypted).toMatch(/^pin:v1:aes256gcm:/);
    const decrypted = await decryptMasterKey(encrypted, "my-pin-1234");
    expect(decrypted).toEqual(key);
  });

  it("wrong PIN throws", async () => {
    const key = await createMasterKey();
    const encrypted = await encryptMasterKey(key, "correct");
    await expect(decryptMasterKey(encrypted, "wrong")).rejects.toThrow();
  });

  it("reads VARS_KEY from env", () => {
    const key = Buffer.from("a".repeat(32));
    process.env.VARS_KEY = key.toString("base64");
    expect(getKeyFromEnv()).toEqual(key);
    delete process.env.VARS_KEY;
  });
});
