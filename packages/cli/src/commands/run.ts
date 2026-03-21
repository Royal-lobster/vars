import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  parse,
  decrypt,
  isEncrypted,
  resolveValue,
  retrieveKey,
} from "@vars/core";
import { buildContext, getMasterKeyFromEnv } from "../utils/context.js";
import * as output from "../utils/output.js";

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
    const ctx = buildContext({ file: args.file, env: args.env });

    const dashIdx = rawArgs.indexOf("--");
    if (dashIdx === -1 || dashIdx === rawArgs.length - 1) {
      output.error("Usage: vars run --env <env> -- <command> [args...]");
      process.exit(1);
    }

    const cmdArgs = rawArgs.slice(dashIdx + 1);
    const command = cmdArgs[0];
    const commandArgs = cmdArgs.slice(1);

    const key = await requireKey();
    const envVars = buildRunEnv(ctx.varsFilePath, ctx.env, key);

    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        ...envVars,
        VARS_ENV: ctx.env,
      },
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
 * Build an environment variable object from a .vars file.
 * Decrypts encrypted values in memory. Never writes to disk.
 */
export function buildRunEnv(
  filePath: string,
  env: string,
  key: Buffer,
): Record<string, string | undefined> {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);
  const result: Record<string, string | undefined> = {};

  for (const variable of parsed.variables) {
    const raw = resolveValue(variable, env);
    if (raw === undefined) continue;

    let value = raw;
    if (isEncrypted(value)) {
      value = decrypt(value, key);
    }

    result[variable.name] = value;
  }

  return result;
}

async function requireKey(): Promise<Buffer> {
  const envKey = getMasterKeyFromEnv();
  if (envKey) return envKey;

  const keychainKey = await retrieveKey();
  if (keychainKey) return keychainKey;

  throw new Error(
    "No decryption key available. Run 'vars unlock' first, or set VARS_KEY env var.",
  );
}
