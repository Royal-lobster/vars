import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { parse } from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as clack from "@clack/prompts";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface CoverageResult {
  percentage: number;
  total: number;
  covered: number;
  missing: string[];
}

export default defineCommand({
  meta: {
    name: "coverage",
    description: "Show % of variables with values set per environment",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to check coverage for",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file, env: args.env });
    const result = calculateCoverage(ctx.varsFilePath, ctx.env);

    output.heading(`Coverage: @${ctx.env}`);

    const color = result.percentage === 100
      ? pc.green
      : result.percentage >= 80
        ? pc.yellow
        : pc.red;

    clack.log.message(`${color(`${result.percentage}%`)} (${result.covered}/${result.total} required variables)`);

    if (result.missing.length > 0) {
      const lines = result.missing.map((name) => `  ${pc.dim("\u2022")} ${name}`);
      clack.log.message(`${pc.red("Missing:")}\n${lines.join("\n")}`);
    }
  },
});

/**
 * Calculate what percentage of required variables have values for a given environment.
 */
export function calculateCoverage(filePath: string, env: string): CoverageResult {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  const required = parsed.variables.filter(
    (v) => !v.schema.includes(".optional()"),
  );

  const missing: string[] = [];

  for (const v of required) {
    const hasEnvValue = v.values.some((val) => val.env === env);
    const hasDefault = v.values.some((val) => val.env === "default");
    if (!hasEnvValue && !hasDefault) {
      missing.push(v.name);
    }
  }

  const total = required.length;
  const covered = total - missing.length;
  const percentage = total === 0 ? 100 : Math.round((covered / total) * 100);

  return { percentage, total, covered, missing };
}
