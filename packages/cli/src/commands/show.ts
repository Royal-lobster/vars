import { defineCommand } from "citty";
import { readFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { decrypt, isEncrypted, regenerateIfStale } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "show",
    description: "Decrypt all values and rename to .vars.unlocked for safe editing",
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
    const decryptedPath = showVarsFile(ctx.varsFilePath, key);
    output.success(`Values decrypted → ${decryptedPath}`);
    output.info("Run 'vars hide' when done editing.");
  },
});

/**
 * Decrypt all encrypted values in .vars, write decrypted content,
 * then rename .vars → .vars.unlocked.
 * This is a simple rename so the editor follows the file.
 */
export function showVarsFile(filePath: string, key: Buffer): string {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const prefix = match[1];
      const value = match[2].trim();
      if (isEncrypted(value)) {
        const decrypted = decrypt(value, key);
        result.push(`${prefix}${decrypted}`);
        continue;
      }
    }
    result.push(line);
  }

  // Write decrypted content into .vars, then rename to .vars.unlocked
  atomicWriteFileSync(filePath, result.join("\n"));

  // Regenerate env.generated.ts before rename (while .vars still exists)
  regenerateIfStale(filePath, ".vars");

  const decryptedPath = resolve(dirname(filePath), "unlocked.vars");
  renameSync(filePath, decryptedPath);
  return decryptedPath;
}
