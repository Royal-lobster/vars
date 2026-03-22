import { defineCommand } from "citty";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { showFile } from "@vars/node";
import { findVarsFile, findKeyFile, requireKey } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "show", description: "Decrypt a .vars file in-place" },
  args: {
    file: { type: "positional", required: false, description: ".vars file to decrypt" },
  },
  async run({ args }) {
    const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }

    // Check file exists BEFORE prompting for PIN
    if (!existsSync(file)) {
      console.error(pc.red(`File not found: ${file}`));
      process.exit(1);
    }

    const keyFile = findKeyFile(file);
    const key = await requireKey(keyFile);
    showFile(file, key);
    console.log(pc.green(`  ✓ Decrypted ${file}`));
  },
});
