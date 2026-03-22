import { defineCommand } from "citty";
import { readFileSync } from "node:fs";
import { hideFile } from "@vars/node";
import { findAllVarsFiles, findKeyFile, requireKey, getProjectRoot } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "hide", description: "Encrypt all unlocked .vars files" },
  args: {},
  async run() {
    const root = getProjectRoot();
    const allFiles = findAllVarsFiles(root);
    const unlocked = allFiles.filter(f => {
      try {
        return readFileSync(f, "utf8").includes("# @vars-state unlocked");
      } catch { return false; }
    });

    if (unlocked.length === 0) {
      console.log(pc.dim("  No unlocked files found"));
      return;
    }

    const keyFile = findKeyFile(process.cwd());
    const key = await requireKey(keyFile);

    for (const f of unlocked) {
      hideFile(f, key);
      console.log(pc.green(`  ✓ Encrypted ${f}`));
    }
  },
});
