import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { createKeyLoader, findVarsFile, KEY_CREDENTIAL_ARGUMENTS } from "../utils/context.js";
import { mutateVarsFile } from "../utils/vars-source-mutation.js";

export default defineCommand({
	meta: { name: "apply", description: "Atomically upsert a .vars fragment from stdin" },
	args: {
		file: { type: "string", alias: "f", description: "Target .vars file" },
		...KEY_CREDENTIAL_ARGUMENTS,
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) throw new Error("No .vars file found");
		if (process.stdin.isTTY) {
			throw new Error("vars apply reads a .vars fragment from stdin");
		}
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const patch = Buffer.concat(chunks).toString("utf8");
		const result = await mutateVarsFile(
			file,
			{ kind: "apply", patch },
			{ getKey: createKeyLoader(file, "vars apply", args) },
		);
		const encryption = result.encrypted ? " and encrypted secrets" : "";
		console.log(
			pc.green(`  ✓ Applied ${result.targets.length} variable(s)${encryption} to ${file}`),
		);
	},
});
