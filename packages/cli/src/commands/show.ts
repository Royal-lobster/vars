import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { showFile, toCanonicalPath, toUnlockedPath } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findVarsFile,
	KEY_CREDENTIAL_ARGUMENTS,
	requireKey,
	resolveKeyFile,
} from "../utils/context.js";

export default defineCommand({
	meta: { name: "show", description: "Human workflow: decrypt a file for editor access" },
	args: {
		file: { type: "positional", required: false, description: ".vars file to decrypt" },
		...KEY_CREDENTIAL_ARGUMENTS,
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) {
			console.error(pc.red("No .vars file found"));
			process.exit(1);
		}

		// Normalize to canonical path for resolution
		const canonical = toCanonicalPath(file);
		const unlockedPath = toUnlockedPath(canonical);

		// If only unlocked exists, already shown
		if (!existsSync(canonical) && existsSync(unlockedPath)) {
			console.log(pc.dim(`  Already unlocked: ${unlockedPath}`));
			return;
		}

		if (!existsSync(file)) {
			console.error(pc.red(`File not found: ${file}`));
			process.exit(1);
		}

		const keyFile = resolveKeyFile(file, args["key-file"]);
		const { key, scope } = await requireKey(keyFile, `vars show ${args.file ?? file}`, {
			pin: args.pin,
			pinFile: args["pin-file"],
			preferEnvelope: typeof args["key-file"] === "string",
		});
		const resultPath = await showFile(file, key, scope);
		console.log(pc.green(`  ✓ Decrypted → ${resultPath}`));
	},
});
