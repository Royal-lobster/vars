import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hideFile, isUnlockedPath, showFile, toCanonicalPath, toUnlockedPath } from "@vars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findKeyFile, findVarsFile, requireKey } from "../utils/context.js";

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

		const canonical = toCanonicalPath(file);
		const unlockedPath = toUnlockedPath(canonical);
		const isUnlocked = isUnlockedPath(file) || existsSync(unlockedPath);

		const keyFile = findKeyFile(file);
		const key = await requireKey(keyFile, `vars toggle ${args.file ?? file}`);

		if (isUnlocked) {
			const target = existsSync(unlockedPath) ? unlockedPath : file;
			const lockedPath = hideFile(target, key);
			console.log(pc.green(`  ✓ Locked → ${lockedPath}`));
		} else {
			const resultPath = showFile(file, key);
			console.log(pc.green(`  ✓ Unlocked → ${resultPath}`));
		}
	},
});
