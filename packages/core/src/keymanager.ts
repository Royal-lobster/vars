import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { CryptoError, KeyError } from "./errors.js";

const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const ALG_NAME = "aes256gcm";

export async function createMasterKey(): Promise<Buffer> {
  return randomBytes(KEY_LENGTH);
}

export async function encryptMasterKey(masterKey: Buffer, pin: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);

  const wrappingKey = await deriveKey(pin, salt);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, wrappingKey, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `pin:${VERSION}:${ALG_NAME}:${salt.toString("base64")}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export async function decryptMasterKey(encoded: string, pin: string): Promise<Buffer> {
  const parsed = parseKeyFile(encoded);
  if (parsed.version !== VERSION) {
    throw new KeyError(`Unsupported key version: ${parsed.version}`);
  }

  const salt = Buffer.from(parsed.salt, "base64");
  const iv = Buffer.from(parsed.iv, "base64");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64");
  const tag = Buffer.from(parsed.tag, "base64");

  const wrappingKey = await deriveKey(pin, salt);

  const decipher = createDecipheriv(ALGORITHM, wrappingKey, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
  } catch {
    throw new KeyError("Invalid PIN");
  }
}

export interface KeyFileComponents {
  version: string;
  algorithm: string;
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export function parseKeyFile(encoded: string): KeyFileComponents {
  const parts = encoded.split(":");
  if (parts.length !== 7 || parts[0] !== "pin") {
    throw new KeyError("Invalid key file format");
  }
  return {
    version: parts[1],
    algorithm: parts[2],
    salt: parts[3],
    iv: parts[4],
    ciphertext: parts[5],
    tag: parts[6],
  };
}

async function deriveKey(pin: string, salt: Buffer): Promise<Buffer> {
  const hash = await argon2.hash(pin, {
    type: argon2.argon2id,
    salt,
    hashLength: KEY_LENGTH,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    raw: true,
  });
  return Buffer.from(hash);
}
