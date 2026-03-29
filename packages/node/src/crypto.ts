import { createCipheriv, createDecipheriv, createHmac, hkdf } from "node:crypto";
import {
	ALGORITHM,
	ALG_NAME,
	IV_LENGTH,
	KEY_LENGTH,
	TAG_LENGTH,
	VERSION,
	parseEncryptedToken,
} from "@dotvars/core";

export async function deriveOwnerKey(masterKey: Buffer, owner: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		hkdf("sha256", masterKey, "", `owner:${owner}`, KEY_LENGTH, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(Buffer.from(derivedKey));
		});
	});
}

export function encryptDeterministic(
	plaintext: string,
	key: Buffer,
	context: string,
	owner?: string,
): string {
	const iv = deriveIV(key, context, plaintext);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	const ownerSegment = owner ? `owner=${owner}:` : "";
	return `enc:${VERSION}:${ALG_NAME}:${ownerSegment}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(encoded: string, key: Buffer): string {
	const parsed = parseEncryptedToken(encoded);
	if (!parsed) throw new Error("Invalid encrypted format");
	const iv = Buffer.from(parsed.iv, "base64");
	const ciphertext = Buffer.from(parsed.ciphertext, "base64");
	const tag = Buffer.from(parsed.tag, "base64");
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
