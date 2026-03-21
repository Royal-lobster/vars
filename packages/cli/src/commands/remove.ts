import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";
import { promptConfirm } from "../utils/prompt.js";

export default defineCommand({
  meta: {
    name: "remove",
    description: "Remove a variable from .vars",
  },
  args: {
    name: {
      type: "positional",
      description: "Variable name to remove",
      required: true,
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompt",
      alias: "y",
      default: false,
    },
  },
  async run({ args }) {
    output.intro("remove");

    const ctx = buildContext({ file: args.file });
    const name = args.name as string;

    if (!args.yes) {
      const confirmed = await promptConfirm(`Remove ${name} from ${ctx.varsFilePath}?`);
      if (!confirmed) {
        output.info("Cancelled.");
        return;
      }
    }

    removeVariable(ctx.varsFilePath, name);
    output.outro(`Removed ${name}`);
  },
});

/**
 * Remove a variable (and all its env values + metadata) from a .vars file.
 */
export function removeVariable(filePath: string, name: string): void {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  if (!parsed.variables.some((v) => v.name === name)) {
    throw new Error(`Variable "${name}" not found in ${filePath}`);
  }

  const lines = content.split("\n");
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const varMatch = line.match(/^([A-Z][A-Z0-9_]*)[ \t]{2,}z\./);
    if (varMatch) {
      if (varMatch[1] === name) {
        skipping = true;
        continue;
      } else {
        skipping = false;
      }
    }

    if (skipping && line.match(/^[ \t]+/)) {
      continue;
    }

    if (skipping && !line.match(/^[ \t]+/) && line.trim() !== "") {
      skipping = false;
    }

    result.push(line);
  }

  const cleaned = result.join("\n").replace(/\n{3,}/g, "\n\n");
  writeFileSync(filePath, cleaned);
}
