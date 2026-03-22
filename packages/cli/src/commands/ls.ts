import { defineCommand } from "citty";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { parse } from "@vars/core";
import { resolveUseChain } from "@vars/node";
import { findAllVarsFiles, getProjectRoot } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "ls", description: "List .vars files or variables" },
  args: {
    file: { type: "positional", required: false },
  },
  async run({ args }) {
    if (args.file) {
      // Detailed variable listing
      const file = resolve(args.file);
      const resolved = resolveUseChain(file, { env: "dev" });
      console.log();
      for (const v of resolved.vars) {
        const vis = v.public ? pc.dim("public") : pc.yellow("secret");
        const schema = pc.dim(v.schema);
        const group = v.group ? pc.dim(`[${v.group}]`) : "";
        let meta = "";
        if (v.metadata?.owner) meta += pc.dim(` owner:${v.metadata.owner}`);
        if (v.metadata?.expires) {
          const expired = new Date(v.metadata.expires) < new Date();
          meta += expired ? pc.red(` expired:${v.metadata.expires}`) : pc.dim(` expires:${v.metadata.expires}`);
        }
        if (v.metadata?.deprecated) meta += pc.yellow(` deprecated`);
        console.log(`  ${vis} ${v.flatName} ${schema} ${group}${meta}`);
      }
      console.log(pc.dim(`\n  ${resolved.vars.length} variables`));
    } else {
      // File overview
      const root = getProjectRoot();
      const files = findAllVarsFiles(root);
      if (files.length === 0) {
        console.log(pc.dim("  No .vars files found"));
        return;
      }
      console.log();
      for (const f of files) {
        const content = readFileSync(f, "utf8");
        const isUnlocked = content.includes("# @vars-state unlocked");
        const result = parse(content, f);
        // Count: if file has imports, show resolved count
        let varCount: number;
        if (result.ast.imports.length > 0) {
          try {
            const resolved = resolveUseChain(f, { env: result.ast.envs[0] ?? "dev" });
            varCount = resolved.vars.length;
          } catch {
            varCount = countVars(result.ast.declarations);
          }
        } else {
          varCount = countVars(result.ast.declarations);
        }
        const state = isUnlocked ? pc.yellow("unlocked") : pc.green("locked  ");
        const relPath = f.replace(root + "/", "");
        // Count warnings
        let warns = 0;
        for (const d of result.ast.declarations) {
          if (d.kind === "variable" && d.metadata?.deprecated) warns++;
          if (d.kind === "variable" && d.metadata?.expires && new Date(d.metadata.expires) < new Date()) warns++;
        }
        const warnStr = warns > 0 ? pc.yellow(` (${warns} warnings)`) : "";
        console.log(`  ${state}  ${relPath}  ${pc.dim(`${varCount} vars`)}${warnStr}`);
      }

      const unlocked = files.filter(f => readFileSync(f, "utf8").includes("# @vars-state unlocked"));
      if (unlocked.length > 0) {
        console.log(pc.yellow(`\n  ${unlocked.length} file(s) unlocked — run \`vars hide\` before committing`));
      }
    }
  },
});

function countVars(decls: any[]): number {
  let count = 0;
  for (const d of decls) {
    if (d.kind === "variable") count++;
    if (d.kind === "group") count += d.declarations.length;
  }
  return count;
}
