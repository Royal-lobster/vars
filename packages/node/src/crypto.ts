import { createCipheriv, createDecipheriv, createHmac } from "node:crypto";
import { ALGORITHM, ALG_NAME, IV_LENGTH, TAG_LENGTH, VERSION } from "@vars/core";

export function encryptDeterministic(plaintext: string, key: Buffer, context: string): string {
	const iv = deriveIV(key, context, plaintext);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `enc:${VERSION}:${ALG_NAME}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(encoded: string, key: Buffer): string {
	const parts = encoded.split(":");
	if (parts.length < 6 || parts[0] !== "enc") throw new Error("Invalid encrypted format");
	const iv = Buffer.from(parts[3], "base64");
	const ciphertext = Buffer.from(parts[4], "base64");
	const tag = Buffer.from(parts[5], "base64");
	const d = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
	d.setAuthTag(tag);
	try {
		return Buffer.concat([d.update(ciphertext), d.final()]).toString("utf8");
	} catch {
		throw new Error("Decryption failed — wrong key or tampered data");
	}
}

function deriveIV(key: Buffer, context: string, plaintext: string): Buffer {
	const hmac = createHmac("sha256", key);
	hmac.update(`${context}:${plaintext}`);
	return hmac.digest().subarray(0, IV_LENGTH);
}
