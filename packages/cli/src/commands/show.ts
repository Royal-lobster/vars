import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { decrypt, isEncrypted } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "show",
    description: "Decrypt all values in-place within .vars for editing",
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
    showVarsFile(ctx.varsFilePath, key);
    output.success("Values decrypted in-place. Run 'vars hide' when done editing.");
  },
});

/**
 * Decrypt all encrypted values in a .vars file in-place.
 */
export function showVarsFile(filePath: string, key: Buffer): void {
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

  atomicWriteFileSync(filePath, result.join("\n"));
}

