import { defineCommand } from "citty";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "blame",
    description: "Show git history of who last changed a variable",
  },
  args: {
    name: {
      type: "positional",
      description: "Variable name",
      required: true,
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file });
    const name = args.name as string;

    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid variable name: ${name}. Must be UPPER_SNAKE_CASE.`);
    }

    const pattern = buildBlamePattern(name);

    try {
      const result = execFileSync("git", [
        "log", "--oneline", "-10", "-S", pattern, "--", ctx.varsFilePath,
      ], { cwd: dirname(ctx.varsFilePath), encoding: "utf8" });

      output.heading(`Blame: ${name}`);
      if (result.trim()) {
        console.log(result);
      } else {
        output.info(`No git history found for ${name} in ${ctx.varsFilePath}`);
      }
    } catch {
      output.error(
        "Failed to run git log. Make sure you are in a git repository.",
      );
      process.exit(1);
    }
  },
});

/**
 * Build a git log search pattern for a variable name.
 */
export function buildBlamePattern(name: string): string {
  return name;
}
