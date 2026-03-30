import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { createMasterKey, encryptMasterKey } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findKeyFile, getProjectRoot, requireKey } from "../utils/context.js";

export default defineCommand({
	meta: { name: "key", description: "Manage encryption keys" },
	subCommands: {
		init: defineCommand({
			meta: { name: "init", description: "Create a new encryption key" },
			async run() {
				if (!process.stdin.isTTY) {
					console.error("This command requires an interactive terminal.");
					process.exit(1);
				}
				const root = getProjectRoot();
				const keyPath = join(root, ".varskey");
				if (existsSync(keyPath)) {
					console.log(pc.yellow("  Key already exists at .varskey"));
					return;
				}
				const pin = await prompts.password({ message: "Set a PIN:" });
				if (prompts.isCancel(pin)) process.exit(0);
				const confirm = await prompts.password({ message: "Confirm PIN:" });
				if (prompts.isCancel(confirm)) process.exit(0);
				if (pin !== confirm) {
					console.error(pc.red("PINs do not match"));
					process.exit(1);
				}
				const key = await createMasterKey();
				const encrypted = await encryptMasterKey(key, pin as string);
				writeFileSync(keyPath, `${encrypted}\n`);
				console.log(pc.green("  ✓ Key created at .varskey"));
			},
		}),
		export: defineCommand({
			meta: { name: "export", description: "Print base64 master key for CI" },
			async run() {
				if (!process.stdin.isTTY) {
					console.error("This command requires an interactive terminal.");
					process.exit(1);
				}
				const keyFile = findKeyFile(process.cwd());
				if (!keyFile) {
					console.error(pc.red("No key found"));
					process.exit(1);
				}
				const { key, scope } = await requireKey(keyFile, "vars key export");
				if (scope !== "master") {
					console.error(pc.red("  Only the master PIN can export the key."));
					process.exit(1);
				}
				console.log(key.toString("base64"));
			},
		}),
	},
});
