import { resolve } from "node:path";
import { resolveUseChain } from "@vars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile } from "../utils/context.js";

export default defineCommand({
	meta: { name: "coverage", description: "Show environment value coverage" },
	args: {
		file: { type: "string", alias: "f", description: ".vars file to check coverage for" },
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) {
			console.error(pc.red("No .vars file found"));
			process.exit(1);
		}

		const preliminary = resolveUseChain(file, { env: "dev" });
		const envs = preliminary.envs;

		// Resolve for each env
		const matrix: Record<string, Record<string, boolean>> = {};
		for (const env of envs) {
			const resolved = resolveUseChain(file, { env });
			for (const v of resolved.vars) {
				if (!matrix[v.flatName]) matrix[v.flatName] = {};
				matrix[v.flatName][env] = v.value !== undefined;
			}
		}

		console.log();
		const header = `  ${"Variable".padEnd(30)} ${envs.map((e) => e.padEnd(8)).join(" ")}`;
		console.log(pc.bold(header));
		console.log(`  ${"-".repeat(header.length - 2)}`);

		for (const [name, coverage] of Object.entries(matrix).sort(([a], [b]) => a.localeCompare(b))) {
			const cells = envs.map((e) => (coverage[e] ? pc.green("  ✓     ") : pc.red("  ✗     ")));
			console.log(`  ${name.padEnd(30)} ${cells.join(" ")}`);
		}
	},
});
