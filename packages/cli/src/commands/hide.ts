import { hideFile } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findKeyFile,
	findUnlockedVarsFiles,
	getProjectRoot,
	requireKey,
} from "../utils/context.js";
import { detectGeneratedPlatform, generateForFileOrThrow } from "./gen.js";

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
		const { key, scope } = await requireKey(keyFile, "vars hide");

		for (const f of unlocked) {
			const lockedPath = await hideFile(f, key, scope);
			console.log(pc.green(`  ✓ Encrypted → ${lockedPath}`));
			regenerateGeneratedForLockedFile(lockedPath);
		}
	},
});

export function regenerateGeneratedForLockedFile(filePath: string): void {
	const existingPlatform = detectGeneratedPlatform(filePath);
	if (existingPlatform) {
		try {
			generateForFileOrThrow(filePath, existingPlatform);
		} catch (err: any) {
			throw new Error(`regeneration failed for ${filePath}: ${err.message}`);
		}
	}
}
