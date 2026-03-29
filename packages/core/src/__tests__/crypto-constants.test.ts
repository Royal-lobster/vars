import { describe, expect, it } from "vitest";
import { isEncrypted, isOwnerEncrypted, parseEncryptedToken } from "../crypto-constants.js";

describe("crypto-constants", () => {
  const masterToken = "enc:v2:aes256gcm-det:AAAA:BBBB:CCCC";
  const ownerToken = "enc:v2:aes256gcm-det:owner=backend-team:AAAA:BBBB:CCCC";

  describe("isEncrypted", () => {
    it("detects master-encrypted tokens", () => {
      expect(isEncrypted(masterToken)).toBe(true);
    });
    it("detects owner-encrypted tokens", () => {
      expect(isEncrypted(ownerToken)).toBe(true);
    });
    it("rejects plain text", () => {
      expect(isEncrypted("hello")).toBe(false);
    });
  });

  describe("parseEncryptedToken", () => {
    it("parses master-encrypted token (no owner)", () => {
      const result = parseEncryptedToken(masterToken);
      expect(result).toEqual({ owner: null, iv: "AAAA", ciphertext: "BBBB", tag: "CCCC" });
    });
    it("parses owner-encrypted token", () => {
      const result = parseEncryptedToken(ownerToken);
      expect(result).toEqual({ owner: "backend-team", iv: "AAAA", ciphertext: "BBBB", tag: "CCCC" });
    });
    it("returns null for non-encrypted strings", () => {
      expect(parseEncryptedToken("hello")).toBeNull();
    });
  });

  describe("isOwnerEncrypted", () => {
    it("returns true when token matches owner", () => {
      expect(isOwnerEncrypted(ownerToken, "backend-team")).toBe(true);
    });
    it("returns false when token has different owner", () => {
      expect(isOwnerEncrypted(ownerToken, "frontend-team")).toBe(false);
    });
    it("returns false for master-encrypted token", () => {
      expect(isOwnerEncrypted(masterToken, "backend-team")).toBe(false);
    });
  });
});
