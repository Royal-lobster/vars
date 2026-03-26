import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateTypeScript } from "@dotvars/core";
import { resolveUseChain } from "@dotvars/node";
import { toCanonicalPath } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findAllVarsFiles, findVarsFile, getProjectRoot } from "../utils/context.js";

export default defineCommand({
	meta: { name: "gen", description: "Generate TypeScript types from .vars files" },
	args: {
		file: { type: "positional", required: false, description: "Entry point .vars file" },
		all: { type: "boolean", description: "Generate for all entry point files" },
		platform: {
			type: "string",
			default: "node",
			description: "Target: node, cloudflare, deno, static",
		},
	},
	async run({ args }) {
		const platform = (args.platform ?? "node") as "node" | "cloudflare" | "deno" | "static";

		if (args.all) {
			const root = getProjectRoot();
			const files = findAllVarsFiles(root);
			if (files.length === 0) {
				console.log(pc.dim("  No .vars files found"));
				return;
			}
			for (const f of files) {
				generateForFile(f, platform);
			}
		} else {
			const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
			if (!file) {
				console.error(pc.red("No .vars file found. Run `vars init` first."));
				process.exit(1);
			}
			generateForFile(file, platform);
		}
	},
});

function generateForFile(filePath: string, platform: string) {
	try {
		const resolved = resolveUseChain(filePath, { env: "dev" });
		const code = generateTypeScript(resolved, { platform: platform as any });
		const outPath = toCanonicalPath(filePath).replace(/\.vars$/, ".generated.ts");
		writeFileSync(outPath, code);
		console.log(pc.green(`  ✓ ${outPath}`));
	} catch (err: any) {
		console.error(pc.red(`  ✗ ${filePath}: ${err.message}`));
	}
}
