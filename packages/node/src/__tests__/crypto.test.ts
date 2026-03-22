import { describe, it, expect } from "vitest";
import { encryptDeterministic, decrypt } from "../crypto.js";
import { isEncrypted } from "@vars/core";
import { randomBytes } from "node:crypto";

describe("crypto", () => {
  const key = randomBytes(32);

  it("encrypts and decrypts roundtrip", () => {
    const encrypted = encryptDeterministic("sk_live_abc", key, "STRIPE@prod");
    expect(decrypt(encrypted, key)).toBe("sk_live_abc");
  });

  it("is deterministic", () => {
    const a = encryptDeterministic("val", key, "X@dev");
    const b = encryptDeterministic("val", key, "X@dev");
    expect(a).toBe(b);
  });

  it("different context → different ciphertext", () => {
    const a = encryptDeterministic("val", key, "A@dev");
    const b = encryptDeterministic("val", key, "B@dev");
    expect(a).not.toBe(b);
  });

  it("isEncrypted detects format", () => {
    const enc = encryptDeterministic("x", key, "ctx");
    expect(isEncrypted(enc)).toBe(true);
    expect(isEncrypted("hello")).toBe(false);
  });

  it("wrong key throws", () => {
    const enc = encryptDeterministic("x", key, "ctx");
    expect(() => decrypt(enc, randomBytes(32))).toThrow();
  });
});
