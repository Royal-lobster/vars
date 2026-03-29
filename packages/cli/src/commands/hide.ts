import { hideFile } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findKeyFile,
	findUnlockedVarsFiles,
	getProjectRoot,
	requireKey,
} from "../utils/context.js";

export default defineCommand({
	meta: { name: "hide", description: "Encrypt all unlocked .vars files" },
	args: {},
	async run() {
		const root = getProjectRoot();
		const unlocked = findUnlockedVarsFiles(root);

		if (unlocked.length === 0) {
			console.log(pc.dim("  No unlocked files found"));
			return;
		}

		const keyFile = findKeyFile(process.cwd());
		const { key } = await requireKey(keyFile, "vars hide");

		for (const f of unlocked) {
			const lockedPath = hideFile(f, key);
			console.log(pc.green(`  ✓ Encrypted → ${lockedPath}`));
		}
	},
});
