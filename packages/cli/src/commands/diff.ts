import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { parse, decrypt, isEncrypted } from "@vars/core";
import { buildContext, getKeyFromEnv } from "../utils/context.js";
import * as clack from "@clack/prompts";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface EnvDiff {
  same: string[];
  different: Array<{ variable: string; leftHas: boolean; rightHas: boolean }>;
  onlyLeft: string[];
  onlyRight: string[];
}

export default defineCommand({
  meta: {
    name: "diff",
    description: "Show differences between environments",
  },
  args: {
    env: {
      type: "string",
      description: "Compare two envs: --env dev,prod",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file });
    const envPair = (args.env ?? "dev,prod").split(",");
    if (envPair.length !== 2) {
      output.error("Provide two environments: --env dev,prod");
      process.exit(1);
    }

    const key = getKeyFromEnv();

    const [left, right] = envPair;
    const diff = diffEnvironments(ctx.varsFilePath, left, right, key ?? undefined);

    output.heading(`Diff: @${left} vs @${right}`);

    if (!key) {
      output.warn("No decryption key available. Encrypted values compared as ciphertext.");
    }

    if (diff.same.length > 0) {
      const lines = diff.same.map((name) => `  ${pc.dim(name)}`);
      clack.log.message(`${pc.green("Same in both")} (${diff.same.length}):\n${lines.join("\n")}`);
    }

    if (diff.different.length > 0) {
      const lines = diff.different.map((d) => `  ${pc.bold(d.variable)}`);
      clack.log.message(`${pc.yellow("Different values")} (${diff.different.length}):\n${lines.join("\n")}`);
    }

    if (diff.onlyLeft.length > 0) {
      const lines = diff.onlyLeft.map((name) => `  ${name}`);
      clack.log.message(`${pc.red(`Only in @${left}`)} (${diff.onlyLeft.length}):\n${lines.join("\n")}`);
    }

    if (diff.onlyRight.length > 0) {
      const lines = diff.onlyRight.map((name) => `  ${name}`);
      clack.log.message(`${pc.red(`Only in @${right}`)} (${diff.onlyRight.length}):\n${lines.join("\n")}`);
    }
  },
});

/**
 * Resolve a value, decrypting if a key is provided.
 */
function resolveForDiff(raw: string, key?: Buffer): string {
  if (isEncrypted(raw) && key) {
    return decrypt(raw, key);
  }
  return raw;
}

/**
 * Compare two environments structurally.
 * When a key is provided, encrypted values are decrypted before comparison.
 */
export function diffEnvironments(
  filePath: string,
  leftEnv: string,
  rightEnv: string,
  key?: Buffer,
): EnvDiff {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  const same: string[] = [];
  const different: Array<{ variable: string; leftHas: boolean; rightHas: boolean }> = [];
  const onlyLeft: string[] = [];
  const onlyRight: string[] = [];

  for (const v of parsed.variables) {
    const leftVal = v.values.find((val) => val.env === leftEnv)
      ?? v.values.find((val) => val.env === "default");
    const rightVal = v.values.find((val) => val.env === rightEnv)
      ?? v.values.find((val) => val.env === "default");

    const hasLeft = leftVal !== undefined;
    const hasRight = rightVal !== undefined;

    if (hasLeft && hasRight) {
      const leftResolved = resolveForDiff(leftVal.value, key);
      const rightResolved = resolveForDiff(rightVal.value, key);
      if (leftResolved === rightResolved) {
        same.push(v.name);
      } else {
        different.push({ variable: v.name, leftHas: true, rightHas: true });
      }
    } else if (hasLeft && !hasRight) {
      onlyLeft.push(v.name);
    } else if (!hasLeft && hasRight) {
      onlyRight.push(v.name);
    }
  }

  return { same, different, onlyLeft, onlyRight };
}
