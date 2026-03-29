import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isUnlockedPath, showFile, toCanonicalPath, toUnlockedPath } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findKeyFile, findVarsFile, requireKey } from "../utils/context.js";

export default defineCommand({
	meta: { name: "show", description: "Decrypt a .vars file (renames to .unlocked.vars)" },
	args: {
		file: { type: "positional", required: false, description: ".vars file to decrypt" },
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

		const keyFile = findKeyFile(file);
		const { key } = await requireKey(keyFile, `vars show ${args.file ?? file}`);
		const resultPath = showFile(file, key);
		console.log(pc.green(`  ✓ Decrypted → ${resultPath}`));
	},
});
