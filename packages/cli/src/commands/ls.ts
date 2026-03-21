import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { parse } from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface VarListEntry {
  name: string;
  schema: string;
  envs: string[];
  required: boolean;
  description?: string;
  deprecated?: string;
  expires?: string;
  owner?: string;
}

export default defineCommand({
  meta: {
    name: "ls",
    description: "List all variables with environments, required/optional status, and metadata",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file });
    const list = listVariables(ctx.varsFilePath);

    if (list.length === 0) {
      output.info("No variables found. Run 'vars add' to add one.");
      return;
    }

    output.heading("Variables");
    const rows = list.map((entry) => ({
      Name: entry.deprecated
        ? pc.strikethrough(pc.dim(entry.name))
        : pc.bold(entry.name),
      Schema: pc.dim(entry.schema),
      Envs: entry.envs.join(", "),
      Required: entry.required ? pc.green("yes") : pc.dim("no"),
      Notes: [
        entry.description,
        entry.deprecated ? `deprecated: ${entry.deprecated}` : null,
        entry.expires ? `expires: ${entry.expires}` : null,
        entry.owner ? `owner: ${entry.owner}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    }));

    output.table(rows);
    output.info(`${list.length} variable(s) total`);
  },
});

/**
 * List all variables from a .vars file with metadata.
 */
export function listVariables(filePath: string): VarListEntry[] {
  const content = readFileSync(filePath, "utf8");
  const parsed = parse(content, filePath);

  return parsed.variables.map((v) => ({
    name: v.name,
    schema: v.schema,
    envs: v.values.map((val) => val.env),
    required: !v.schema.includes(".optional()"),
    description: v.metadata.description,
    deprecated: v.metadata.deprecated,
    expires: v.metadata.expires,
    owner: v.metadata.owner,
  }));
}
