import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as prompts from "@clack/prompts";
import {
	createMasterKey,
	encryptMasterKey,
	hideFile,
	isUnlockedPath,
	parseKeyFile,
	showFile,
	toLockedPath,
	toUnlockedPath,
} from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findAllVarsFiles,
	getProjectRoot,
	KEY_CREDENTIAL_ARGUMENTS,
	NEW_PIN_ARGUMENT,
	NEW_PIN_FILE_ARGUMENT,
	requireKey,
	resolveExplicitPin,
	resolveKeyFile,
} from "../utils/context.js";

export default defineCommand({
	meta: { name: "rotate", description: "Rotate the encryption key" },
	args: {
		...KEY_CREDENTIAL_ARGUMENTS,
		"new-pin": NEW_PIN_ARGUMENT,
		"new-pin-file": NEW_PIN_FILE_ARGUMENT,
		yes: { type: "boolean", description: "Confirm owner PIN invalidation" },
	},
	async run({ args }) {
		const newPin = resolveExplicitPin({ pin: args["new-pin"], pinFile: args["new-pin-file"] });
		if (!newPin && !process.stdin.isTTY) {
			console.error("Provide --new-pin or --new-pin-file for non-interactive use.");
			process.exit(1);
		}
		const keyFile = resolveKeyFile(process.cwd(), args["key-file"]);
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
			if (!args.yes) {
				if (!process.stdin.isTTY) {
					console.error(pc.red("Pass --yes to confirm owner PIN invalidation."));
					process.exit(1);
				}
				const proceed = await prompts.confirm({ message: "Continue?" });
				if (prompts.isCancel(proceed) || !proceed) process.exit(0);
			}
		}

		// Decrypt with old key (must be master)
		const { key: oldKey, scope } = await requireKey(keyFile, "vars rotate", {
			pin: args.pin,
			pinFile: args["pin-file"],
		});
		if (scope !== "master") {
			console.error(pc.red("  Only the master PIN can rotate keys."));
			process.exit(1);
		}

		// Create new key + PIN
		let replacementPin = newPin;
		if (!replacementPin) {
			const promptedPin = await prompts.password({ message: "Set new PIN:" });
			if (prompts.isCancel(promptedPin)) process.exit(0);
			const confirm = await prompts.password({ message: "Confirm new PIN:" });
			if (prompts.isCancel(confirm)) process.exit(0);
			if (promptedPin !== confirm) {
				console.error(pc.red("PINs do not match"));
				process.exit(1);
			}
			replacementPin = promptedPin as string;
		}

		const newKey = await createMasterKey();
		const root = getProjectRoot();
		const files = findAllVarsFiles(root);
		const encryptedKey = await encryptMasterKey(newKey, replacementPin);
		await rotateFiles(files, keyFile, oldKey, newKey, encryptedKey);
		console.log(pc.green("\n  ✓ Key rotated. Share the new .varskey + PIN with teammates."));
	},
});

export async function rotateFiles(
	files: string[],
	keyFile: string,
	oldKey: Buffer,
	newKey: Buffer,
	encryptedKey: string,
): Promise<void> {
	const originals = new Map<string, Buffer>();
	for (const path of files) {
		originals.set(path, readFileSync(path));
		const counterpart = isUnlockedPath(path) ? toLockedPath(path) : toUnlockedPath(path);
		if (existsSync(counterpart)) originals.set(counterpart, readFileSync(counterpart));
	}
	const originalKey = readFileSync(keyFile);
	try {
		// Save the recoverable new key before any file uses it.
		writeFileSync(keyFile, `${encryptedKey}\n`);
		for (const f of files) {
			if (readFileSync(f, "utf8").includes("enc:v2:")) {
				const unlocked = await showFile(f, oldKey, "master");
				await hideFile(unlocked, newKey, "master");
				console.log(pc.green(`  ✓ Re-encrypted ${f}`));
			}
		}
	} catch (error) {
		writeFileSync(keyFile, originalKey);
		for (const path of files) {
			const counterpart = isUnlockedPath(path) ? toLockedPath(path) : toUnlockedPath(path);
			if (!originals.has(counterpart) && existsSync(counterpart)) rmSync(counterpart);
		}
		for (const [path, content] of originals) {
			writeFileSync(path, content);
		}
		throw error;
	}
}
