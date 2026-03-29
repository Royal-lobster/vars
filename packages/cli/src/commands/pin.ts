import { readFileSync, writeFileSync } from "node:fs";
import * as prompts from "@clack/prompts";
import {
  deriveOwnerKey,
  encryptMasterKey,
  parseKeyFile,
  showFile,
  hideFile,
} from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findAllVarsFiles, findKeyFile, getProjectRoot, requireKey } from "../utils/context.js";

export default defineCommand({
  meta: { name: "pin", description: "Manage owner PINs" },
  subCommands: {
    create: defineCommand({
      meta: { name: "create", description: "Create a PIN for an owner" },
      args: {
        owner: { type: "positional", required: true, description: "Owner name (e.g., backend-team)" },
      },
      async run({ args }) {
        if (!process.stdin.isTTY) {
          console.error("This command requires an interactive terminal.");
          process.exit(1);
        }

        const keyFile = findKeyFile(process.cwd());
        if (!keyFile) {
          console.error(pc.red("No key found. Run `vars init` first."));
          process.exit(1);
        }

        const owner = args.owner as string;

        // Check if owner entry already exists
        const keyContent = readFileSync(keyFile, "utf8").trim();
        const entries = parseKeyFile(keyContent);
        const existing = entries.find((e) => e.scope === `owner:${owner}`);
        if (existing) {
          console.error(pc.red(`  PIN for owner "${owner}" already exists in .vars/key`));
          process.exit(1);
        }

        // Require master PIN
        console.log(pc.dim("  Authenticate with master PIN to create owner PIN"));
        const { key: masterKey, scope } = await requireKey(keyFile, `vars pin create ${owner}`);
        if (scope !== "master") {
          console.error(pc.red("  Owner PINs cannot create other owner PINs. Use the master PIN."));
          process.exit(1);
        }

        // Derive owner sub-key
        const ownerKey = await deriveOwnerKey(masterKey, owner);

        // Set owner PIN
        const pin = await prompts.password({ message: `Set PIN for ${owner}:` });
        if (prompts.isCancel(pin)) process.exit(0);
        const confirm = await prompts.password({ message: "Confirm PIN:" });
        if (prompts.isCancel(confirm)) process.exit(0);
        if (pin !== confirm) {
          console.error(pc.red("  PINs do not match"));
          process.exit(1);
        }

        // Wrap owner key with PIN
        const encryptedOwnerKey = await encryptMasterKey(ownerKey, pin as string, owner);

        // Append to key file
        writeFileSync(keyFile, `${keyContent}\n${encryptedOwnerKey}\n`);

        // Re-encrypt owner fields across all .vars files
        const root = getProjectRoot();
        const files = findAllVarsFiles(root);
        let reEncrypted = 0;
        for (const f of files) {
          const content = readFileSync(f, "utf8");
          if (content.includes(`owner = "${owner}"`)) {
            const unlocked = await showFile(f, masterKey, "master");
            await hideFile(unlocked, masterKey, "master");
            reEncrypted++;
          }
        }

        console.log(pc.green(`  ✓ PIN created for owner "${owner}"`));
        if (reEncrypted > 0) {
          console.log(pc.dim(`  Re-encrypted ${reEncrypted} file(s) with owner-scoped keys`));
        }
        console.log(pc.dim("  Share the PIN with the owner. They can use it with `vars show` / `vars hide`."));
      },
    }),
  },
});
