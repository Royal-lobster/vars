import { defineCommand } from "citty";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "@vars/core";
import { findVarsFile } from "../utils/context.js";
import * as prompts from "@clack/prompts";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "add", description: "Add a variable to a .vars file" },
  args: {
    name: { type: "positional", required: true, description: "Variable name (UPPER_SNAKE_CASE)" },
    file: { type: "string", alias: "f" },
  },
  async run({ args }) {
    if (!process.stdin.isTTY) {
      console.error(pc.red("vars add requires an interactive terminal."));
      console.error(pc.dim("To add variables non-interactively, edit the .vars file directly."));
      process.exit(1);
    }

    const file = args.file ? resolve(args.file as string) : findVarsFile(process.cwd());
    if (!file) { console.error(pc.red("No .vars file found")); process.exit(1); }

    const name = args.name as string;
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      console.error(pc.red("Variable name must be UPPER_SNAKE_CASE"));
      process.exit(1);
    }

    const isPublic = await prompts.confirm({ message: "Is this a public (non-secret) variable?" });
    if (prompts.isCancel(isPublic)) process.exit(0);

    const schema = await prompts.text({
      message: "Zod schema (or press Enter for z.string()):",
      placeholder: "z.string()",
      defaultValue: "z.string()",
    });
    if (prompts.isCancel(schema)) process.exit(0);

    // Get envs from file
    const content = readFileSync(file, "utf8");
    const result = parse(content, file);
    const envs = result.ast.envs.length > 0 ? result.ast.envs : ["default"];

    const values: Record<string, string> = {};
    for (const env of envs) {
      const val = await prompts.text({ message: `Value for ${env} (or skip):`, defaultValue: "" });
      if (prompts.isCancel(val)) process.exit(0);
      if (val) values[env] = val as string;
    }

    // Build the new variable block
    const lines: string[] = [];
    const prefix = isPublic ? "public " : "";
    const schemaStr = schema !== "z.string()" ? ` : ${schema}` : "";

    if (Object.keys(values).length === 0) {
      lines.push(`${prefix}${name}${schemaStr}`);
    } else if (Object.keys(values).length === 1 && values["default"]) {
      lines.push(`${prefix}${name}${schemaStr} = "${values["default"]}"`);
    } else {
      lines.push(`${prefix}${name}${schemaStr} {`);
      for (const [env, val] of Object.entries(values)) {
        lines.push(`  ${env} = "${val}"`);
      }
      lines.push("}");
    }

    // Append to file
    const newContent = content.trimEnd() + "\n\n" + lines.join("\n") + "\n";
    writeFileSync(file, newContent);
    console.log(pc.green(`  ✓ Added ${name} to ${file}`));
  },
});
