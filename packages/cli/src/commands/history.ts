import { defineCommand } from "citty";
import { execSync } from "node:child_process";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "history",
    description: "Show full change history of a variable across environments",
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
    const cmd = buildHistoryCommand(name, ctx.varsFilePath);

    try {
      const result = execSync(cmd, { cwd: ctx.cwd, encoding: "utf8" });

      output.heading(`History: ${name}`);
      if (result.trim()) {
        console.log(result);
      } else {
        output.info(`No history found for ${name}`);
      }
    } catch {
      output.error("Failed to run git log. Make sure you are in a git repository.");
      process.exit(1);
    }
  },
});

/**
 * Build a git log command to show history for a variable in a .vars file.
 */
export function buildHistoryCommand(name: string, varsFilePath: string): string {
  return `git log --all -p -S "${name}" -- "${varsFilePath}"`;
}
