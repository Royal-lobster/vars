import { defineCommand } from "citty";
import { readFileSync, existsSync } from "node:fs";
import { parse, isEncrypted } from "@vars/core";
import { buildContext, resolveEnv } from "../utils/context.js";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface VarsStatus {
  varsFileExists: boolean;
  keyFileExists: boolean;
  encrypted: boolean;
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

    output.heading("vars status");

    console.log(`  File:         ${ctx.varsFilePath}`);
    console.log(
      `  State:        ${status.encrypted ? pc.green("encrypted") : pc.yellow("decrypted (run 'vars hide')")}`,
    );
    console.log(`  Variables:    ${status.variableCount}`);
    console.log(`  Environments: ${status.environments.join(", ") || "none"}`);
    console.log(`  Active env:   ${ctx.env}`);
    console.log(
      `  Key file:     ${status.keyFileExists ? pc.green("found") : pc.red("missing")}`,
    );
  },
});

/**
 * Get status information about a .vars file.
 */
export function getStatus(filePath: string): VarsStatus {
  const varsFileExists = existsSync(filePath);
  const keyFileExists = existsSync(filePath.replace(/\.vars$/, ".vars.key"));

  if (!varsFileExists) {
    return {
      varsFileExists: false,
      keyFileExists,
      encrypted: false,
      variableCount: 0,
      environments: [],
      activeEnv: resolveEnv(),
    };
  }

  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  let encrypted = false;
  for (const v of parsed.variables) {
    for (const val of v.values) {
      encrypted = isEncrypted(val.value);
      break;
    }
    if (encrypted) break;
  }

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
    encrypted,
    variableCount: parsed.variables.length,
    environments: [...envSet].sort(),
    activeEnv: resolveEnv(),
  };
}
