export const ALGORITHM = "aes-256-gcm" as const;
export const IV_LENGTH = 12;
export const TAG_LENGTH = 16;
export const KEY_LENGTH = 32;
export const VERSION = "v2";
export const ALG_NAME = "aes256gcm-det";
export const PREFIX = `enc:${VERSION}:${ALG_NAME}:`;

/** Check if a string value is an encrypted token */
export function isEncrypted(value: string): boolean {
	return value.startsWith(PREFIX);
}

export interface EncryptedTokenParts {
	owner: string | null;
	iv: string;
	ciphertext: string;
	tag: string;
}

export function parseEncryptedToken(value: string): EncryptedTokenParts | null {
	if (!value.startsWith(PREFIX)) return null;
	const rest = value.slice(PREFIX.length);
	const parts = rest.split(":");
	if (parts.length === 4 && parts[0].startsWith("owner=")) {
		return { owner: parts[0].slice("owner=".length), iv: parts[1], ciphertext: parts[2], tag: parts[3] };
	}
	if (parts.length === 3) {
		return { owner: null, iv: parts[0], ciphertext: parts[1], tag: parts[2] };
	}
	return null;
}

export function isOwnerEncrypted(value: string, owner: string): boolean {
	const parsed = parseEncryptedToken(value);
	return parsed !== null && parsed.owner === owner;
}
