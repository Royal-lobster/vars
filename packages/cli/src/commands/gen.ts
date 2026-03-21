import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, generateTypes } from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as clack from "@clack/prompts";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "gen",
    description: "Generate typed accessors from .vars",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
    output: {
      type: "string",
      description: "Output file path",
      alias: "o",
      default: "env.generated.ts",
    },
    lang: {
      type: "string",
      description: "Target language (ts)",
      default: "ts",
    },
  },
  async run({ args }) {
    output.intro("gen");

    const ctx = buildContext({ file: args.file });
    const outputPath = resolve(ctx.cwd, args.output ?? "env.generated.ts");

    const s = clack.spinner();
    s.start("Generating typed accessors...");
    generateFromFile(ctx.varsFilePath, outputPath);
    s.stop("Generated typed accessors.");

    output.outro("Generated vars.generated.ts");
  },
});

/**
 * Parse a .vars file and generate a typed accessor file.
 */
export function generateFromFile(varsFilePath: string, outputPath: string): void {
  const content = readFileSync(varsFilePath, "utf8");
  const parsed = parse(content, varsFilePath);
  const generated = generateTypes(parsed, varsFilePath);
  writeFileSync(outputPath, generated);
}
