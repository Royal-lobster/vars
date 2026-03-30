import { readFileSync, writeFileSync } from "node:fs";
import * as prompts from "@clack/prompts";
import { createMasterKey, encryptMasterKey, hideFile, parseKeyFile, showFile } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findAllVarsFiles, findKeyFile, getProjectRoot, requireKey } from "../utils/context.js";

export default defineCommand({
	meta: { name: "rotate", description: "Rotate the encryption key" },
	args: {},
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

		// Warn if owner entries exist — they'll be dropped and need re-creation
		const keyContent = readFileSync(keyFile, "utf8").trim();
		const entries = parseKeyFile(keyContent);
		const ownerEntries = entries.filter((e) => e.scope !== "master");
		if (ownerEntries.length > 0) {
			const ownerNames = ownerEntries.map((e) => e.scope.replace("owner:", ""));
			console.log(
				pc.yellow(
					`  ⚠ ${ownerEntries.length} owner PIN(s) will be invalidated: ${ownerNames.join(", ")}`,
				),
			);
			console.log(
				pc.dim("  You'll need to re-run `vars pin create` for each owner after rotation."),
			);
			const proceed = await prompts.confirm({ message: "Continue?" });
			if (prompts.isCancel(proceed) || !proceed) process.exit(0);
		}

		// Decrypt with old key (must be master)
		const { key: oldKey, scope } = await requireKey(keyFile, "vars rotate");
		if (scope !== "master") {
			console.error(pc.red("  Only the master PIN can rotate keys."));
			process.exit(1);
		}

		// Create new key + PIN
		const pin = await prompts.password({ message: "Set new PIN:" });
		if (prompts.isCancel(pin)) process.exit(0);
		const confirm = await prompts.password({ message: "Confirm new PIN:" });
		if (prompts.isCancel(confirm)) process.exit(0);
		if (pin !== confirm) {
			console.error(pc.red("PINs do not match"));
			process.exit(1);
		}

		const newKey = await createMasterKey();
		const root = getProjectRoot();
		const files = findAllVarsFiles(root);

		// Decrypt all files with old key, re-encrypt with new key
		for (const f of files) {
			const content = readFileSync(f, "utf8");
			if (content.includes("enc:v2:")) {
				await showFile(f, oldKey, "master");
				await hideFile(f, newKey, "master");
				console.log(pc.green(`  ✓ Re-encrypted ${f}`));
			}
		}

		// Save new key
		const encryptedKey = await encryptMasterKey(newKey, pin as string);
		writeFileSync(keyFile, `${encryptedKey}\n`);
		console.log(pc.green("\n  ✓ Key rotated. Share the new .varskey + PIN with teammates."));
	},
});
