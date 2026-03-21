import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import {
  decryptMasterKey,
  storeKey,
} from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";
import { promptPIN } from "../utils/prompt.js";

export default defineCommand({
  meta: {
    name: "unlock",
    description: "Enter PIN to cache decrypted key in OS keychain",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file });
    const pin = await promptPIN("Enter PIN");

    try {
      const masterKey = await unlockKey(ctx.keyFilePath, pin);
      output.success("Key unlocked and cached in OS keychain");
      output.info("Run 'vars lock' to clear the cached key");
    } catch (err) {
      output.error(`Failed to unlock: ${(err as Error).message}`);
      process.exit(1);
    }
  },
});

/**
 * Decrypt the master key from the key file using PIN, store in keychain.
 * Returns the decrypted master key.
 */
export async function unlockKey(keyFilePath: string, pin: string): Promise<Buffer> {
  const encoded = readFileSync(keyFilePath, "utf8").trim();
  const masterKey = await decryptMasterKey(encoded, pin);
  await storeKey(masterKey);
  return masterKey;
}
