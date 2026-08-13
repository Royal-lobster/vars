import { hideFile } from "@dotvars/node";
import type { KeyScope } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findKeyFile,
	findUnlockedVarsFiles,
	getProjectRoot,
	PIN_ARGUMENT,
	requireKey,
} from "../utils/context.js";
import { detectGeneratedPlatform, generateForFileOrThrow } from "./gen.js";

export default defineCommand({
	meta: { name: "hide", description: "Encrypt all unlocked .vars files" },
	args: {
		pin: PIN_ARGUMENT,
	},
	async run({ args }) {
		const root = getProjectRoot();
		const unlocked = findUnlockedVarsFiles(root);

		if (unlocked.length === 0) {
			console.log(pc.dim("  No unlocked files found"));
			return;
		}

		const keyFile = findKeyFile(process.cwd());
		const { key, scope } = await requireKey(keyFile, "vars hide", args.pin);
		const regenerationFailures = await hideUnlockedFiles(unlocked, key, scope);
		if (regenerationFailures > 0) {
			console.error(
				pc.red(`  ${regenerationFailures} generated file(s) failed to regenerate after encryption`),
			);
			process.exitCode = 1;
		}
	},
});

export async function hideUnlockedFiles(
	unlocked: string[],
	key: Buffer,
	scope: KeyScope,
	regenerateLockedFile: (filePath: string) => void = regenerateGeneratedForLockedFile,
): Promise<number> {
	let regenerationFailures = 0;

	for (const f of unlocked) {
		const lockedPath = await hideFile(f, key, scope);
		console.log(pc.green(`  ✓ Encrypted → ${lockedPath}`));
		try {
			regenerateLockedFile(lockedPath);
		} catch (err: any) {
			regenerationFailures++;
			console.error(pc.red(`  ✗ ${err.message}`));
		}
	}

	return regenerationFailures;
}

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
