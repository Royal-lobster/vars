import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ALGORITHM, IV_LENGTH, KEY_LENGTH, TAG_LENGTH } from "@dotvars/core";

export interface KeyEntry {
	scope: string; // "master" or "owner:<name>"
	raw: string;   // the full pin:v1:... line
}

export async function createMasterKey(): Promise<Buffer> {
	return randomBytes(KEY_LENGTH);
}

export async function encryptMasterKey(masterKey: Buffer, pin: string, owner?: string): Promise<string> {
	const argon2 = await import("argon2");
	const salt = randomBytes(16);
	const wrappingKey = await argon2.default.hash(pin, {
		type: argon2.default.argon2id,
		salt,
		hashLength: KEY_LENGTH,
		memoryCost: 65536,
		timeCost: 3,
		parallelism: 1,
		raw: true,
	});
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, Buffer.from(wrappingKey), iv, {
		authTagLength: TAG_LENGTH,
	});
	const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
	const tag = cipher.getAuthTag();
	const scope = owner ? `owner=${owner}` : "master";
	return `pin:v1:aes256gcm:${scope}:${salt.toString("base64")}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export async function decryptMasterKey(encoded: string, pin: string): Promise<Buffer> {
	const parts = encoded.split(":");
	if (parts.length < 7 || parts[0] !== "pin") throw new Error("Invalid key format");

	// New format: pin:v1:aes256gcm:<scope>:<salt>:<iv>:<ct>:<tag> (8 parts)
	// Legacy format: pin:v1:aes256gcm:<salt>:<iv>:<ct>:<tag> (7 parts)
	const isScoped = parts.length >= 8 && (parts[3] === "master" || parts[3].startsWith("owner="));
	const saltIdx = isScoped ? 4 : 3;

	const argon2 = await import("argon2");
	const salt = Buffer.from(parts[saltIdx], "base64");
	const iv = Buffer.from(parts[saltIdx + 1], "base64");
	const ciphertext = Buffer.from(parts[saltIdx + 2], "base64");
	const tag = Buffer.from(parts[saltIdx + 3], "base64");
	const wrappingKey = await argon2.default.hash(pin, {
		type: argon2.default.argon2id,
		salt,
		hashLength: KEY_LENGTH,
		memoryCost: 65536,
		timeCost: 3,
		parallelism: 1,
		raw: true,
	});
	const decipher = createDecipheriv(ALGORITHM, Buffer.from(wrappingKey), iv, {
		authTagLength: TAG_LENGTH,
	});
	decipher.setAuthTag(tag);
	try {
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch {
		throw new Error("Invalid PIN");
	}
}

export function parseKeyFile(content: string): KeyEntry[] {
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line.startsWith("pin:"))
		.map((line) => {
			const parts = line.split(":");
			const isScoped = parts.length >= 8 && (parts[3] === "master" || parts[3].startsWith("owner="));
			let scope: string;
			if (isScoped) {
				scope = parts[3] === "master" ? "master" : parts[3].replace("owner=", "owner:");
			} else {
				scope = "master"; // legacy format
			}
			return { scope, raw: line };
		});
}

export function getKeyFromEnv(): Buffer | null {
	const envKey = process.env.VARS_KEY;
	return envKey ? Buffer.from(envKey, "base64") : null;
}
