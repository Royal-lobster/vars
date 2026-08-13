import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findAllVarsFiles, findVarsFile, getProjectRoot } from "../utils/context.js";
import {
	detectGeneratedPlatform,
	generateForFileOrThrow,
	type GeneratedPlatform,
} from "../utils/generated-output.js";

export { detectGeneratedPlatform };
export type { GeneratedPlatform };

export default defineCommand({
	meta: { name: "gen", description: "Generate TypeScript types from .vars files" },
	args: {
		file: { type: "positional", required: false, description: "Entry point .vars file" },
		all: { type: "boolean", description: "Generate for all entry point files" },
		platform: {
			type: "string",
			default: "node",
			description: "Target: node, serverless, deno, static",
		},
	},
	async run({ args, rawArgs }) {
		if (args.all) {
			const root = getProjectRoot();
			const files = findAllVarsFiles(root);
			if (files.length === 0) {
				console.log(pc.dim("  No .vars files found"));
				return;
			}
			for (const f of files) {
				const platform = resolvePlatformArg(args.platform, rawArgs, f);
				generateForFile(f, platform);
			}
		} else {
			const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
			if (!file) {
				console.error(pc.red("No .vars file found. Run `vars init` first."));
				process.exit(1);
			}
			const platform = resolvePlatformArg(args.platform, rawArgs, file);
			generateForFile(file, platform);
		}
	},
});

export function resolvePlatformArg(
	platform: unknown,
	rawArgs: string[],
	filePath?: string,
): string {
	if (typeof platform === "string" && platform !== "node") return platform;
	for (let i = rawArgs.length - 1; i >= 0; i--) {
		const arg = rawArgs[i];
		if (arg.startsWith("--platform=")) return arg.slice("--platform=".length);
		if (arg === "--platform" && rawArgs[i + 1]) return rawArgs[i + 1];
	}
	if (filePath) {
		const existingPlatform = detectGeneratedPlatform(filePath);
		if (existingPlatform) return existingPlatform;
	}
	return typeof platform === "string" ? platform : "node";
}

export function generateForFile(filePath: string, platform: string) {
	if (platform === "cloudflare") {
		console.error(
			pc.red(
				`  ✗ ${filePath}: --platform cloudflare was removed. Use --platform serverless (see https://vars.dev/docs/frameworks/cloudflare for the migration guide).`,
			),
		);
		process.exit(1);
	}

	try {
		generateForFileOrThrow(filePath, platform);
	} catch (err: any) {
		console.error(pc.red(`  ✗ ${filePath}: ${err.message}`));
		process.exitCode = 1;
	}
}
