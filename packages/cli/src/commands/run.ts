import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  isEncrypted,
  loadVars,
  extractValue,
} from "@vars/core";
import type { LoadOptions } from "@vars/core";
import { buildContext, requireKey, getKeyFromEnv } from "../utils/context.js";
import { ENV_VALUE_LINE_VALUE_ONLY } from "../utils/patterns.js";
import { hideVarsFile } from "./hide.js";
import * as output from "../utils/output.js";
import pc from "picocolors";

export default defineCommand({
  meta: {
    name: "run",
    description: "Decrypt in memory, inject into process.env, run command",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to use",
      required: true,
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args, rawArgs }) {
    output.intro("run");

    const ctx = buildContext({ file: args.file, env: args.env });

    const dashIdx = rawArgs.indexOf("--");
    if (dashIdx === -1 || dashIdx === rawArgs.length - 1) {
      output.error("Usage: vars run --env <env> -- <command> [args...]");
      process.exit(1);
    }

    const cmdArgs = rawArgs.slice(dashIdx + 1);
    const command = cmdArgs[0];
    const commandArgs = cmdArgs.slice(1);

    // If unlocked.vars exists, auto-encrypt it back to vault.vars first
    const isUnlocked = ctx.varsFilePath.endsWith("unlocked.vars");
    let key: Buffer | null = getKeyFromEnv();

    if (isUnlocked && !key) {
      // Need PIN to encrypt unlocked → vault
      key = await requireKey();
      const vaultPath = resolve(dirname(ctx.varsFilePath), "vault.vars");
      output.info(`Encrypting secrets \u2192 vault.vars`);
      hideVarsFile(vaultPath, key);
      // Update context to point to vault.vars
      ctx.varsFilePath = vaultPath;
    } else if (!isUnlocked && !key) {
      // vault.vars with encrypted values — need PIN
      if (fileHasEncryptedValues(ctx.varsFilePath)) {
        key = await requireKey();
      }
    }

    const envVars = buildRunEnv(ctx.varsFilePath, ctx.env, key);

    output.outro(`Injected ${Object.keys(envVars).length} variables.`);

    const childEnv: Record<string, string | undefined> = {
      ...process.env,
      ...envVars,
      VARS_ENV: ctx.env,
    };
    if (key) childEnv.VARS_KEY = key.toString("base64");

    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      env: childEnv,
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });

    child.on("error", (err) => {
      output.error(`Failed to start command: ${err.message}`);
      process.exit(1);
    });
  },
});

/**
 * Check if a .vars file contains any encrypted values.
 */
function fileHasEncryptedValues(filePath: string): boolean {
  const content = readFileSync(filePath, "utf8");
  return content.split("\n").some((line) => {
    const match = line.match(ENV_VALUE_LINE_VALUE_ONLY);
    return match && isEncrypted(match[1].trim());
  });
}

/**
 * Build an environment variable object from a .vars file.
 * Decrypts encrypted values in memory. Never writes to disk.
 */
export function buildRunEnv(
  filePath: string,
  env: string,
  key: Buffer | null,
): Record<string, string | undefined> {
  const options: LoadOptions = { env };
  if (key) options.key = key;

  const validated = loadVars(filePath, options);
  const result: Record<string, string | undefined> = {};

  for (const [name, value] of Object.entries(validated)) {
    if (value === undefined || value === null) continue;
    result[name] = extractValue(value);
  }

  return result;
}
