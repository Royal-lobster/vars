import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, isEncrypted, parseEncryptedValue } from "../crypto.js";

describe("crypto", () => {
  const key = randomBytes(32);
  const wrongKey = randomBytes(32);

  describe("encrypt/decrypt roundtrip", () => {
    it("encrypts and decrypts a simple string", () => {
      const plaintext = "postgres://user:pass@localhost:5432/db";
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts an empty string", () => {
      const encrypted = encrypt("", key);
      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe("");
    });

    it("encrypts and decrypts unicode", () => {
      const plaintext = "hello world";
      const encrypted = encrypt(plaintext, key);
      expect(decrypt(encrypted, key)).toBe(plaintext);
    });

    it("produces different ciphertext for same plaintext (unique IV)", () => {
      const plaintext = "same-value";
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted format", () => {
      const encrypted = encrypt("test", key);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("returns false for plaintext", () => {
      expect(isEncrypted("just-a-string")).toBe(false);
    });

    it("returns false for partial prefix", () => {
      expect(isEncrypted("enc:v1:")).toBe(false);
    });
  });

  describe("parseEncryptedValue", () => {
    it("parses encrypted string into components", () => {
      const encrypted = encrypt("test", key);
      const parsed = parseEncryptedValue(encrypted);
      expect(parsed.version).toBe("v1");
      expect(parsed.algorithm).toBe("aes256gcm");
      expect(parsed.iv).toBeTruthy();
      expect(parsed.ciphertext).toBeTruthy();
      expect(parsed.tag).toBeTruthy();
    });

    it("throws on invalid format", () => {
      expect(() => parseEncryptedValue("not-encrypted")).toThrow();
    });
  });

  describe("error cases", () => {
    it("throws on wrong key", () => {
      const encrypted = encrypt("secret", key);
      const wrongKey = randomBytes(32);
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("throws on tampered ciphertext", () => {
      const encrypted = encrypt("secret", key);
      const tampered = encrypted.slice(0, -4) + "XXXX";
      expect(() => decrypt(tampered, key)).toThrow();
    });
  });
});
