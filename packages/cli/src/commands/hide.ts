import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { encrypt, isEncrypted, retrieveKey } from "@vars/core";
import { buildContext, getMasterKeyFromEnv } from "../utils/context.js";
import * as output from "../utils/output.js";

const ENV_VALUE_LINE = /^([ \t]+@[\w-]+[ \t]+=[ \t]+)(.+)$/;

export default defineCommand({
  meta: {
    name: "hide",
    description: "Re-encrypt all values in-place within .vars",
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
    output.success("All values encrypted in-place.");
  },
});

/**
 * Encrypt all plaintext values in a .vars file in-place.
 */
export function hideVarsFile(filePath: string, key: Buffer): void {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const prefix = match[1];
      const value = match[2].trim();
      if (!isEncrypted(value)) {
        const encrypted = encrypt(value, key);
        result.push(`${prefix}${encrypted}`);
        continue;
      }
    }
    result.push(line);
  }

  writeFileSync(filePath, result.join("\n"));
}

async function requireKey(): Promise<Buffer> {
  const envKey = getMasterKeyFromEnv();
  if (envKey) return envKey;

  const keychainKey = await retrieveKey();
  if (keychainKey) return keychainKey;

  throw new Error(
    "No encryption key available. Run 'vars unlock' first, or set VARS_KEY env var.",
  );
}
