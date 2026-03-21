import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { parse, decrypt, isEncrypted, retrieveKey } from "@vars/core";
import { buildContext, getMasterKeyFromEnv } from "../utils/context.js";
import * as output from "../utils/output.js";
import { promptConfirm } from "../utils/prompt.js";

export interface PushPayload {
  variables: Record<string, string>;
  env: string;
  platform: string;
}

export default defineCommand({
  meta: {
    name: "push",
    description: "Push decrypted vars to a deployment platform",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to push",
      required: true,
    },
    vercel: { type: "boolean", description: "Push to Vercel" },
    netlify: { type: "boolean", description: "Push to Netlify" },
    railway: { type: "boolean", description: "Push to Railway" },
    fly: { type: "boolean", description: "Push to Fly.io" },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file, env: args.env });
    const key = await requireKey();

    const platform = args.vercel
      ? "vercel"
      : args.netlify
        ? "netlify"
        : args.railway
          ? "railway"
          : args.fly
            ? "fly"
            : null;

    if (!platform) {
      output.error("Specify a platform: --vercel, --netlify, --railway, or --fly");
      process.exit(1);
    }

    const payload = buildPushPayload(ctx.varsFilePath, ctx.env, key);
    const varCount = Object.keys(payload.variables).length;

    output.info(`Pushing ${varCount} variables to ${platform} (@${ctx.env})`);

    const confirmed = await promptConfirm(
      `Push ${varCount} decrypted variables to ${platform}?`,
    );
    if (!confirmed) {
      output.info("Cancelled.");
      return;
    }

    output.warn(`${platform} push not yet implemented. Coming soon!`);
  },
});

/**
 * Build a payload of decrypted key-value pairs for platform push.
 */
export function buildPushPayload(
  filePath: string,
  env: string,
  key: Buffer,
): PushPayload {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);
  const variables: Record<string, string> = {};

  for (const v of parsed.variables) {
    const envVal = v.values.find((val) => val.env === env);
    const defaultVal = v.values.find((val) => val.env === "default");
    const raw = envVal?.value ?? defaultVal?.value;

    if (raw === undefined) continue;

    let value = raw;
    if (isEncrypted(value)) {
      value = decrypt(value, key);
    }

    variables[v.name] = value;
  }

  return { variables, env, platform: "" };
}

async function requireKey(): Promise<Buffer> {
  const envKey = getMasterKeyFromEnv();
  if (envKey) return envKey;

  const keychainKey = await retrieveKey();
  if (keychainKey) return keychainKey;

  throw new Error("No key available. Run 'vars unlock' first, or set VARS_KEY env var.");
}
