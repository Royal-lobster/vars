import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { createMasterKey, decryptMasterKey, encryptMasterKey } from "@vars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findKeyFile, getProjectRoot } from "../utils/context.js";

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
				const varsDir = join(root, ".vars");
				const keyPath = join(varsDir, "key");
				if (existsSync(keyPath)) {
					console.log(pc.yellow("  Key already exists at .vars/key"));
					return;
				}
				if (!existsSync(varsDir)) mkdirSync(varsDir, { recursive: true });
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
				console.log(pc.green("  ✓ Key created at .vars/key"));
			},
		}),
		fingerprint: defineCommand({
			meta: { name: "fingerprint", description: "Print key fingerprint" },
			async run() {
				const keyFile = findKeyFile(process.cwd());
				if (!keyFile) {
					console.error(pc.red("No key found"));
					process.exit(1);
				}
				const encoded = readFileSync(keyFile, "utf8").trim();
				const hash = createHash("sha256").update(encoded).digest("hex").slice(0, 16);
				console.log(`  ${hash}`);
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
				const encoded = readFileSync(keyFile, "utf8").trim();
				const pin = await prompts.password({ message: "Enter PIN:" });
				if (prompts.isCancel(pin)) process.exit(0);
				const key = await decryptMasterKey(encoded, pin as string);
				console.log(key.toString("base64"));
			},
		}),
	},
});
