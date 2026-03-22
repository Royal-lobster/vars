import { defineCommand } from "citty";
import { readFileSync, writeFileSync } from "node:fs";
import { createMasterKey, encryptMasterKey, showFile, hideFile } from "@vars/node";
import { findKeyFile, findAllVarsFiles, requireKey, getProjectRoot } from "../utils/context.js";
import * as prompts from "@clack/prompts";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "rotate", description: "Rotate the encryption key" },
  args: {},
  async run() {
    const keyFile = findKeyFile(process.cwd());
    if (!keyFile) { console.error(pc.red("No key found")); process.exit(1); }

    // Decrypt with old key
    const oldKey = await requireKey(keyFile);

    // Create new key + PIN
    const pin = await prompts.password({ message: "Set new PIN:" });
    if (prompts.isCancel(pin)) process.exit(0);
    const confirm = await prompts.password({ message: "Confirm new PIN:" });
    if (prompts.isCancel(confirm)) process.exit(0);
    if (pin !== confirm) { console.error(pc.red("PINs do not match")); process.exit(1); }

    const newKey = await createMasterKey();
    const root = getProjectRoot();
    const files = findAllVarsFiles(root);

    // Decrypt all files with old key, re-encrypt with new key
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      if (content.includes("enc:v2:")) {
        showFile(f, oldKey);
        hideFile(f, newKey);
        console.log(pc.green(`  ✓ Re-encrypted ${f}`));
      }
    }

    // Save new key
    const encryptedKey = await encryptMasterKey(newKey, pin as string);
    writeFileSync(keyFile, encryptedKey + "\n");
    console.log(pc.green("\n  ✓ Key rotated. Share the new .vars/key + PIN with teammates."));
  },
});
