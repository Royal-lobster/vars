import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { encrypt, parse } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import * as output from "../utils/output.js";
import { promptText } from "../utils/prompt.js";

export default defineCommand({
  meta: {
    name: "add",
    description: "Add a new variable with type, values per env, auto-encrypt",
  },
  args: {
    name: {
      type: "positional",
      description: "Variable name (UPPER_SNAKE_CASE)",
      required: true,
    },
    schema: {
      type: "string",
      description: "Zod schema (e.g., z.string().url())",
      alias: "s",
    },
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
    public: {
      type: "boolean",
      description: "Store value without encryption (for non-secret config)",
      default: false,
    },
  },
  async run({ args }) {
    output.intro("add");

    const ctx = buildContext({ file: args.file });
    const key = await requireKey();

    const name = args.name as string;
    const schema = args.schema ?? (await promptText("Zod schema", { placeholder: "z.string()" }));

    const values: Array<{ env: string; value: string }> = [];
    const envs = ["default", "dev", "staging", "prod"];
    for (const envName of envs) {
      const value = await promptText(`Value for @${envName} (leave empty to skip)`, {
        default: "",
      });
      if (value) {
        values.push({ env: envName, value });
      }
    }

    addVariable(ctx.varsFilePath, key, { name, schema, values, isPublic: args.public as boolean });
    output.outro(`Added ${name}`);
  },
});

/**
 * Add a variable to a .vars file. Encrypts values before writing.
 */
export function addVariable(
  filePath: string,
  key: Buffer,
  variable: {
    name: string;
    schema: string;
    values: Array<{ env: string; value: string }>;
    isPublic?: boolean;
  },
): void {
  const content = readFileSync(filePath, "utf8");

  // Check if variable already exists
  const parsed = parse(content || "# vars\n", filePath);
  if (parsed.variables.some((v) => v.name === variable.name)) {
    throw new Error(`Variable "${variable.name}" already exists in ${filePath}`);
  }

  // Build new lines
  const lines: string[] = [];
  lines.push("");
  lines.push(`${variable.name}  ${variable.schema}`);
  if (variable.isPublic) {
    lines.push("  @public");
  }
  for (const { env, value } of variable.values) {
    const finalValue = variable.isPublic ? value : encrypt(value, key);
    lines.push(`  @${env.padEnd(8)} = ${finalValue}`);
  }

  const newContent = content.trimEnd() + "\n" + lines.join("\n") + "\n";
  writeFileSync(filePath, newContent);
}

