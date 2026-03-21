import { defineCommand } from "citty";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, isEncrypted } from "@vars/core";
import { buildContext, resolveEnv } from "../utils/context.js";
import * as clack from "@clack/prompts";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface VarsStatus {
  varsFileExists: boolean;
  keyFileExists: boolean;
  encryptionState: "encrypted" | "decrypted" | "mixed";
  variableCount: number;
  environments: string[];
  activeEnv: string;
}

export default defineCommand({
  meta: {
    name: "status",
    description: "Show current state: encrypted/decrypted, keychain, env, variable count",
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
    const status = getStatus(ctx.varsFilePath);

    const stateLabel =
      status.encryptionState === "encrypted"
        ? pc.green("encrypted")
        : status.encryptionState === "mixed"
          ? pc.yellow("mixed (some values unencrypted!)")
          : pc.yellow("decrypted (run 'vars hide')");

    const noteContent = [
      `File:         ${ctx.varsFilePath}`,
      `State:        ${stateLabel}`,
      `Variables:    ${status.variableCount}`,
      `Environments: ${status.environments.join(", ") || "none"}`,
      `Active env:   ${ctx.env}`,
      `Key file:     ${status.keyFileExists ? pc.green("found") : pc.red("missing")}`,
    ].join("\n");

    clack.note(noteContent, "vars status");
  },
});

/**
 * Get status information about a .vars file.
 * Scans ALL values across ALL variables to determine encryption state.
 */
export function getStatus(filePath: string): VarsStatus {
  const varsFileExists = existsSync(filePath);
  const keyFileExists = existsSync(resolve(dirname(filePath), "key"));

  if (!varsFileExists) {
    return {
      varsFileExists: false,
      keyFileExists,
      encryptionState: "decrypted",
      variableCount: 0,
      environments: [],
      activeEnv: resolveEnv(),
    };
  }

  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  let hasEncrypted = false;
  let hasPlaintext = false;
  for (const v of parsed.variables) {
    for (const val of v.values) {
      if (isEncrypted(val.value)) hasEncrypted = true;
      else hasPlaintext = true;
    }
  }

  const encryptionState = hasEncrypted && hasPlaintext
    ? "mixed"
    : hasEncrypted
      ? "encrypted"
      : "decrypted";

  const envSet = new Set<string>();
  for (const v of parsed.variables) {
    for (const val of v.values) {
      if (val.env !== "default") {
        envSet.add(val.env);
      }
    }
  }

  return {
    varsFileExists,
    keyFileExists,
    encryptionState,
    variableCount: parsed.variables.length,
    environments: [...envSet].sort(),
    activeEnv: resolveEnv(),
  };
}
