import { defineCommand } from "citty";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { showFile, hideFile } from "@vars/node";
import { findVarsFile, findKeyFile, requireKey } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "toggle", description: "Toggle between locked/unlocked state" },
  args: {
    file: { type: "positional", required: false },
  },
  async run({ args }) {
    const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }
    const content = readFileSync(file, "utf8");
    const isUnlocked = content.includes("# @vars-state unlocked");
    const keyFile = findKeyFile(file);
    const key = await requireKey(keyFile);

    if (isUnlocked) {
      hideFile(file, key);
      console.log(pc.green(`  ✓ Locked ${file}`));
    } else {
      showFile(file, key);
      console.log(pc.green(`  ✓ Unlocked ${file}`));
    }
  },
});
