import { defineCommand } from "citty";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { encrypt, isEncrypted, regenerateIfStale, parse } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE, countVariables } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";
import * as clack from "@clack/prompts";

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
    output.intro("hide");

    const ctx = buildContext({ file: args.file });
    const key = await requireKey(ctx);

    // Count variables before encryption
    const decryptedPath = resolve(dirname(ctx.varsFilePath), "unlocked.vars");
    const sourcePath = existsSync(decryptedPath) ? decryptedPath : ctx.varsFilePath;
    const varCount = countVariables(sourcePath);

    hideVarsFile(ctx.varsFilePath, key);

    output.outro(`Locked. ${varCount} variable${varCount !== 1 ? "s" : ""} encrypted.`);
  },
});

/**
 * Encrypt all plaintext values and rename .vars.unlocked → .vars.
 * Uses encrypt-all-or-nothing: if any value fails to encrypt,
 * the file is not modified.
 */
export function hideVarsFile(filePath: string, key: Buffer): void {
  const varsDir = dirname(filePath);
  const vaultPath = resolve(varsDir, "vault.vars");
  const unlockedPath = resolve(varsDir, "unlocked.vars");

  // Determine source: prefer unlocked.vars if it exists
  const sourcePath = existsSync(unlockedPath) ? unlockedPath : filePath;

  const content = readFileSync(sourcePath, "utf8");
  const lines = content.split("\n");
  const encryptedLines: string[] = [];

  // Parse to find @public variables
  const parsed = parse(content, sourcePath);
  const publicVars = new Set(
    parsed.variables
      .filter((v) => v.metadata.public)
      .map((v) => v.name),
  );

  // Track which variable each line belongs to
  const VAR_DECL = /^([A-Z][A-Z0-9_]*)[ \t]{2,}z\./;
  let currentVarName: string | null = null;

  // Encrypt into a new array first -- don't modify the file until ALL values succeed
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current variable
    const varMatch = line.match(VAR_DECL);
    if (varMatch) {
      currentVarName = varMatch[1];
    }

    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const [, prefix, value] = match;
      // Skip encryption for @public variables
      if (currentVarName && publicVars.has(currentVarName)) {
        encryptedLines.push(line);
        continue;
      }
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

  // Write encrypted content to vault.vars
  atomicWriteFileSync(vaultPath, encryptedLines.join("\n"));

  // Remove unlocked.vars if it was the source
  if (sourcePath === unlockedPath && existsSync(unlockedPath)) {
    unlinkSync(unlockedPath);
  }

  // Regenerate vars.generated.ts if schemas changed
  regenerateIfStale(vaultPath, ".vars");
}
