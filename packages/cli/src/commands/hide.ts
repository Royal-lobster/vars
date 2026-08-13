import { hideFile } from "@dotvars/node";
import type { KeyScope } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	findUnlockedVarsFiles,
	getProjectRoot,
	KEY_CREDENTIAL_ARGUMENTS,
	requireKey,
	resolveKeyFile,
} from "../utils/context.js";
import { detectGeneratedPlatform, generateForFileOrThrow } from "../utils/generated-output.js";

export default defineCommand({
	meta: { name: "hide", description: "Human workflow: encrypt files opened with vars show" },
	args: {
		...KEY_CREDENTIAL_ARGUMENTS,
	},
	async run({ args }) {
		const root = getProjectRoot();
		const unlocked = findUnlockedVarsFiles(root);

		if (unlocked.length === 0) {
			console.log(pc.dim("  No unlocked files found"));
			return;
		}

		const keyFile = resolveKeyFile(process.cwd(), args["key-file"]);
		const { key, scope } = await requireKey(keyFile, "vars hide", {
			pin: args.pin,
			pinFile: args["pin-file"],
			preferEnvelope: typeof args["key-file"] === "string",
		});
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
			const generatedPath = generateForFileOrThrow(filePath, existingPlatform);
			console.log(pc.green(`  ✓ ${generatedPath}`));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`regeneration failed for ${filePath}: ${message}`);
		}
	}
}
