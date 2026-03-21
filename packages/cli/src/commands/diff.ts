import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { parse } from "@vars/core";
import { buildContext } from "../utils/context.js";
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

    const [left, right] = envPair;
    const diff = diffEnvironments(ctx.varsFilePath, left, right);

    output.heading(`Diff: @${left} vs @${right}`);

    if (diff.same.length > 0) {
      console.log(`\n  ${pc.green("Same in both")} (${diff.same.length}):`);
      for (const name of diff.same) {
        console.log(`    ${pc.dim(name)}`);
      }
    }

    if (diff.different.length > 0) {
      console.log(`\n  ${pc.yellow("Different values")} (${diff.different.length}):`);
      for (const d of diff.different) {
        console.log(`    ${pc.bold(d.variable)}`);
      }
    }

    if (diff.onlyLeft.length > 0) {
      console.log(`\n  ${pc.red(`Only in @${left}`)} (${diff.onlyLeft.length}):`);
      for (const name of diff.onlyLeft) {
        console.log(`    ${name}`);
      }
    }

    if (diff.onlyRight.length > 0) {
      console.log(`\n  ${pc.red(`Only in @${right}`)} (${diff.onlyRight.length}):`);
      for (const name of diff.onlyRight) {
        console.log(`    ${name}`);
      }
    }
  },
});

/**
 * Compare two environments structurally.
 */
export function diffEnvironments(
  filePath: string,
  leftEnv: string,
  rightEnv: string,
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
      if (leftVal.value === rightVal.value) {
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
