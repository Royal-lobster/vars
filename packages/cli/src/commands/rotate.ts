import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  encrypt,
  decrypt,
  isEncrypted,
} from "@vars/core";
import * as output from "../utils/output.js";
import { promptPIN } from "../utils/prompt.js";

const ENV_VALUE_LINE = /^([ \t]+@[\w-]+[ \t]+=[ \t]+)(.+)$/;

export default defineCommand({
  meta: {
    name: "rotate",
    description: "Generate new key + PIN, re-encrypt all values",
  },
  async run() {
    const cwd = process.cwd();

    const oldPin = await promptPIN("Enter current PIN");
    const newPin = await promptPIN("Choose new PIN");
    const newPinConfirm = await promptPIN("Confirm new PIN");

    if (newPin !== newPinConfirm) {
      output.error("New PINs do not match. Aborting.");
      process.exit(1);
    }

    try {
      await rotateKey(cwd, oldPin, newPin);
      output.success("Key rotated successfully. All values re-encrypted with new key.");
      output.info("Share the new .vars.key + new PIN with teammates.");
    } catch (err) {
      output.error(`Rotation failed: ${(err as Error).message}`);
      process.exit(1);
    }
  },
});

/**
 * Rotate the encryption key.
 */
export async function rotateKey(
  cwd: string,
  oldPin: string,
  newPin: string,
): Promise<{ newKey: Buffer }> {
  const keyPath = join(cwd, ".vars.key");
  const varsPath = join(cwd, ".vars");

  const oldKeyEncoded = readFileSync(keyPath, "utf8").trim();
  const oldKey = await decryptMasterKey(oldKeyEncoded, oldPin);

  const newKey = await createMasterKey();

  const content = readFileSync(varsPath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const prefix = match[1];
      const value = match[2].trim();
      if (isEncrypted(value)) {
        const plaintext = decrypt(value, oldKey);
        const reEncrypted = encrypt(plaintext, newKey);
        result.push(`${prefix}${reEncrypted}`);
        continue;
      }
    }
    result.push(line);
  }

  writeFileSync(varsPath, result.join("\n"));

  const newKeyEncoded = await encryptMasterKey(newKey, newPin);
  writeFileSync(keyPath, newKeyEncoded + "\n");

  return { newKey };
}
