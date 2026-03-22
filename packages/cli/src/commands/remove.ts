import { defineCommand } from "citty";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { findVarsFile } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "remove", description: "Remove a variable from a .vars file" },
  args: {
    name: { type: "positional", required: true, description: "Variable name to remove" },
    file: { type: "string", alias: "f" },
  },
  async run({ args }) {
    const file = args.file ? resolve(args.file as string) : findVarsFile(process.cwd());
    if (!file) { console.error(pc.red("No .vars file found")); process.exit(1); }

    const name = args.name as string;
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    const result: string[] = [];
    let skipping = false;
    let found = false;

    for (const line of lines) {
      // Detect the variable declaration (with or without "public" prefix)
      const declMatch = line.match(new RegExp(`^(public\\s+)?${name}(\\s|$|:)`));
      if (declMatch && !skipping) {
        skipping = true;
        found = true;
        continue;
      }

      if (skipping) {
        // Skip indented lines (env values, metadata) and closing braces
        if (line.match(/^\s+/) || line.trim() === "}" || line.trim() === ")") {
          continue;
        }
        // Also skip a closing brace/paren at the start of a line
        skipping = false;
      }

      result.push(line);
    }

    if (!found) {
      console.error(pc.red(`  Variable "${name}" not found`));
      process.exit(1);
    }

    // Clean up double blank lines
    const cleaned = result.join("\n").replace(/\n{3,}/g, "\n\n");
    writeFileSync(file, cleaned);
    console.log(pc.green(`  ✓ Removed ${name} from ${file}`));
  },
});
