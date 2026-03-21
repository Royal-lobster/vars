import { defineCommand } from "citty";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { encrypt, isEncrypted } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "hide",
    description: "Re-encrypt all values and restore to .vars",
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
    const key = await requireKey();
    hideVarsFile(ctx.varsFilePath, key);
    output.success("All values encrypted → .vars restored.");
  },
});

/**
 * Encrypt all plaintext values and rename .vars.decrypted → .vars.
 * Uses encrypt-all-or-nothing: if any value fails to encrypt,
 * the file is not modified.
 */
export function hideVarsFile(filePath: string, key: Buffer): void {
  // Determine source: prefer .vars.decrypted if it exists (show/hide flow)
  const decryptedPath = filePath + ".decrypted";
  const sourcePath = existsSync(decryptedPath) ? decryptedPath : filePath;

  const content = readFileSync(sourcePath, "utf8");
  const lines = content.split("\n");
  const encryptedLines: string[] = [];

  // Encrypt into a new array first -- don't modify the file until ALL values succeed
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const [, prefix, value] = match;
      if (!isEncrypted(value.trim())) {
        try {
          const encrypted = encrypt(value.trim(), key);
          encryptedLines.push(`${prefix}${encrypted}`);
        } catch (err) {
          throw new Error(`Failed to encrypt value at line ${i + 1}: ${(err as Error).message}`);
        }
        continue;
      }
    }
    encryptedLines.push(line);
  }

  // Write encrypted content into source, then rename to .vars
  atomicWriteFileSync(sourcePath, encryptedLines.join("\n"));
  if (sourcePath !== filePath) {
    renameSync(sourcePath, filePath);
  }
}
