import { randomBytes } from "node:crypto";
import { isEncrypted, isOwnerEncrypted, parseEncryptedToken } from "@dotvars/core";
import { describe, expect, it } from "vitest";
import { decrypt, deriveOwnerKey, encryptDeterministic } from "../crypto.js";

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

describe("deriveOwnerKey", () => {
	const masterKey = randomBytes(32);

	it("derives a 32-byte key", async () => {
		const ownerKey = await deriveOwnerKey(masterKey, "backend-team");
		expect(ownerKey.length).toBe(32);
	});

	it("is deterministic — same inputs produce same key", async () => {
		const a = await deriveOwnerKey(masterKey, "backend-team");
		const b = await deriveOwnerKey(masterKey, "backend-team");
		expect(a).toEqual(b);
	});

	it("different owners produce different keys", async () => {
		const a = await deriveOwnerKey(masterKey, "backend-team");
		const b = await deriveOwnerKey(masterKey, "frontend-team");
		expect(a).not.toEqual(b);
	});

	it("derived key is different from master key", async () => {
		const ownerKey = await deriveOwnerKey(masterKey, "backend-team");
		expect(ownerKey).not.toEqual(masterKey);
	});
});

describe("owner-tagged encryption", () => {
	const masterKey = randomBytes(32);

	it("encrypts with owner tag in prefix", async () => {
		const ownerKey = await deriveOwnerKey(masterKey, "backend-team");
		const encrypted = encryptDeterministic("secret", ownerKey, "VAR@dev", "backend-team");
		expect(encrypted).toContain("owner=backend-team:");
		expect(isOwnerEncrypted(encrypted, "backend-team")).toBe(true);
	});

	it("encrypts without owner tag when owner is undefined", () => {
		const encrypted = encryptDeterministic("secret", masterKey, "VAR@dev");
		expect(encrypted).not.toContain("owner=");
		const parsed = parseEncryptedToken(encrypted);
		expect(parsed?.owner).toBeNull();
	});

	it("decrypts owner-tagged tokens", async () => {
		const ownerKey = await deriveOwnerKey(masterKey, "backend-team");
		const encrypted = encryptDeterministic("my-secret", ownerKey, "VAR@dev", "backend-team");
		const decrypted = decrypt(encrypted, ownerKey);
		expect(decrypted).toBe("my-secret");
	});

	it("owner key cannot decrypt master-encrypted token", async () => {
		const ownerKey = await deriveOwnerKey(masterKey, "backend-team");
		const masterEncrypted = encryptDeterministic("secret", masterKey, "VAR@dev");
		expect(() => decrypt(masterEncrypted, ownerKey)).toThrow();
	});

	it("wrong owner key cannot decrypt other owner's token", async () => {
		const backendKey = await deriveOwnerKey(masterKey, "backend-team");
		const frontendKey = await deriveOwnerKey(masterKey, "frontend-team");
		const encrypted = encryptDeterministic("secret", backendKey, "VAR@dev", "backend-team");
		expect(() => decrypt(encrypted, frontendKey)).toThrow();
	});
});
