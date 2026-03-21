import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { isEncrypted, retrieveKey } from "@vars/core";
import { buildContext, getMasterKeyFromEnv } from "../utils/context.js";
import { showVarsFile } from "./show.js";
import { hideVarsFile } from "./hide.js";
import * as output from "../utils/output.js";

const ENV_VALUE_LINE = /^[ \t]+@[\w-]+[ \t]+=[ \t]+(.+)$/;

export default defineCommand({
  meta: {
    name: "toggle",
    description: "Flip between show/hide states",
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
    const action = toggleVarsFile(ctx.varsFilePath, key);

    if (action === "show") {
      output.success("Values decrypted in-place (was encrypted).");
    } else {
      output.success("Values encrypted in-place (was decrypted).");
    }
  },
});

/**
 * Detect current state and toggle. Returns "show" or "hide" depending on what was done.
 */
export function toggleVarsFile(filePath: string, key: Buffer): "show" | "hide" {
  const content = readFileSync(filePath, "utf8");
  const currentlyEncrypted = detectEncryptedState(content);

  if (currentlyEncrypted) {
    showVarsFile(filePath, key);
    return "show";
  } else {
    hideVarsFile(filePath, key);
    return "hide";
  }
}

function detectEncryptedState(content: string): boolean {
  for (const line of content.split("\n")) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      return isEncrypted(match[1].trim());
    }
  }
  return true;
}

async function requireKey(): Promise<Buffer> {
  const envKey = getMasterKeyFromEnv();
  if (envKey) return envKey;

  const keychainKey = await retrieveKey();
  if (keychainKey) return keychainKey;

  throw new Error(
    "No key available. Run 'vars unlock' first, or set VARS_KEY env var.",
  );
}
