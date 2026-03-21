import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedValue } from "./types.js";
import { CryptoError } from "./errors.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";
const ALG_NAME = "aes256gcm";
const PREFIX = `enc:${VERSION}:${ALG_NAME}:`;

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:${VERSION}:${ALG_NAME}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decrypt(encoded: string, key: Buffer): string {
  const parsed = parseEncryptedValue(encoded);

  if (parsed.version !== VERSION) {
    throw new CryptoError(`Unsupported encryption version: ${parsed.version}. Update vars CLI.`);
  }

  const iv = Buffer.from(parsed.iv, "base64");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64");
  const tag = Buffer.from(parsed.tag, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new CryptoError("Decryption failed — wrong key or tampered data");
  }
}

export function isEncrypted(value: string): boolean {
  if (!value.startsWith(PREFIX)) return false;
  const parts = value.split(":");
  return parts.length === 6;
}

export function parseEncryptedValue(encoded: string): EncryptedValue {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== "enc") {
    throw new CryptoError(`Invalid encrypted value format: expected enc:v1:aes256gcm:<iv>:<ciphertext>:<tag>`);
  }

  return {
    version: parts[1],
    algorithm: parts[2],
    iv: parts[3],
    ciphertext: parts[4],
    tag: parts[5],
  };
}
