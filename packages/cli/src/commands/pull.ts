import { defineCommand } from "citty";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse, encrypt } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "pull",
    description: "Pull current vars from a platform, encrypt, update .vars",
  },
  args: {
    vercel: { type: "boolean", description: "Pull from Vercel" },
    netlify: { type: "boolean", description: "Pull from Netlify" },
    env: {
      type: "string",
      description: "Environment label for pulled values",
      default: "prod",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    output.intro("pull");

    const platform = args.vercel ? "vercel" : args.netlify ? "netlify" : null;
    if (!platform) {
      output.error("Specify a platform: --vercel or --netlify");
      process.exit(1);
    }

    output.warn(`${platform} pull not yet implemented. Coming soon!`);
    output.info("This will pull env vars from the platform, encrypt them, and update .vars.");
  },
});

/**
 * Merge pulled variables into a .vars file.
 */
export function mergePulledVars(
  filePath: string,
  key: Buffer,
  pulled: Record<string, string>,
  env: string,
): void {
  let lines: string[] = [];
  let existingVarNames = new Set<string>();

  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf8");
    lines = content.split("\n");
    try {
      const parsed = parse(content, filePath);
      existingVarNames = new Set(parsed.variables.map((v) => v.name));

      for (const v of parsed.variables) {
        if (pulled[v.name] !== undefined) {
          const encValue = encrypt(pulled[v.name], key);
          const varLineIdx = lines.findIndex((l) =>
            l.startsWith(`${v.name}  `),
          );
          if (varLineIdx >= 0) {
            let insertIdx = varLineIdx + 1;
            while (insertIdx < lines.length && lines[insertIdx].match(/^[ \t]+/)) {
              insertIdx++;
            }
            lines.splice(insertIdx, 0, `  @${env.padEnd(8)} = ${encValue}`);
          }
        }
      }
    } catch {
      // Parse failed
    }
  }

  for (const [name, value] of Object.entries(pulled)) {
    if (!existingVarNames.has(name)) {
      const encValue = encrypt(value, key);
      lines.push("");
      lines.push(`${name}  z.string()`);
      lines.push(`  @${env.padEnd(8)} = ${encValue}`);
    }
  }

  writeFileSync(filePath, lines.join("\n"));
}
