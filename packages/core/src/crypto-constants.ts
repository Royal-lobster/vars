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
