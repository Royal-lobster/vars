import { defineCommand } from "citty";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { parse } from "@vars/core";
import { buildContext } from "../utils/context.js";
import * as output from "../utils/output.js";
import pc from "picocolors";

export interface TypecheckResult {
  defined: string[];
  undefined: string[];
  references: Array<{ file: string; line: number; varName: string }>;
}

export default defineCommand({
  meta: {
    name: "typecheck",
    description: "Scan codebase for process.env references not defined in .vars",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
    dir: {
      type: "string",
      description: "Directory to scan",
      default: "src",
    },
  },
  async run({ args }) {
    const ctx = buildContext({ file: args.file });
    const scanDir = join(ctx.cwd, args.dir ?? "src");
    const result = scanProcessEnvRefs(scanDir, ctx.varsFilePath);

    output.heading("vars typecheck");

    if (result.undefined.length === 0) {
      output.success(
        `All process.env references are defined in .vars (${result.defined.length} found)`,
      );
    } else {
      output.error(
        `Found ${result.undefined.length} undefined env var reference(s):`,
      );
      for (const ref of result.references.filter((r) =>
        result.undefined.includes(r.varName),
      )) {
        console.log(
          `  ${pc.dim(ref.file)}:${pc.yellow(String(ref.line))} \u2014 ${pc.red(ref.varName)}`,
        );
      }
      console.log("");
      output.info("Add these variables to .vars or remove the references.");
      process.exit(1);
    }
  },
});

const PROCESS_ENV_PATTERN = /process\.env\.([A-Z][A-Z0-9_]*)/g;
const IMPORT_META_ENV_PATTERN = /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g;
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

/**
 * Scan source files for process.env and import.meta.env references.
 */
export function scanProcessEnvRefs(
  scanDir: string,
  varsFilePath: string,
): TypecheckResult {
  let definedVarNames: Set<string>;
  try {
    const content = readFileSync(varsFilePath, "utf8");
    const parsed = parse(content, varsFilePath);
    definedVarNames = new Set(parsed.variables.map((v) => v.name));
  } catch {
    definedVarNames = new Set();
  }

  const references: Array<{ file: string; line: number; varName: string }> = [];
  const allRefs = new Set<string>();

  function scanFile(filePath: string) {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of [PROCESS_ENV_PATTERN, IMPORT_META_ENV_PATTERN]) {
        const regex = new RegExp(pattern.source, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(line)) !== null) {
          const varName = match[1];
          allRefs.add(varName);
          references.push({ file: filePath, line: i + 1, varName });
        }
      }
    }
  }

  function walkDir(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (SCAN_EXTENSIONS.has(extname(entry))) {
          scanFile(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  walkDir(scanDir);

  const defined = [...allRefs].filter((v) => definedVarNames.has(v));
  const undefinedVars = [...allRefs].filter((v) => !definedVarNames.has(v));

  return { defined, undefined: undefinedVars, references };
}
