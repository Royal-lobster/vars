import { resolve } from "node:path";
import { isEncrypted } from "@dotvars/core";
import { decrypt, getKeyFromEnv, resolveUseChain } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findKeyFile, findVarsFile, requireKey } from "../utils/context.js";

export default defineCommand({
	meta: { name: "diff", description: "Compare values across environments" },
	args: {
		env: { type: "string", required: true, description: "Comma-separated envs (e.g., dev,prod)" },
		file: { type: "positional", required: false },
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) {
			console.error(pc.red("No .vars file found"));
			process.exit(1);
		}

		const envs = (args.env as string).split(",").map((e) => e.trim());
		if (envs.length < 2) {
			console.error(pc.red("Provide at least 2 environments: --env dev,prod"));
			process.exit(1);
		}

		let key: Buffer | null = getKeyFromEnv();
		const keyFile = findKeyFile(file);

		// Resolve for each env
		const byEnv: Record<string, Record<string, string | undefined>> = {};
		for (const env of envs) {
			const resolved = resolveUseChain(file, { env });
			byEnv[env] = {};
			for (const v of resolved.vars) {
				let val = v.value;
				if (val && isEncrypted(val)) {
					if (!key && keyFile)
						try {
							({ key } = await requireKey(keyFile, "vars diff"));
						} catch {}
					if (key) {
						try {
							val = decrypt(val, key);
						} catch {
							val = pc.dim("<encrypted>");
						}
					} else val = pc.dim("<encrypted>");
				}
				byEnv[env][v.flatName] = val;
			}
		}

		// Find all variable names
		const allVars = new Set<string>();
		for (const env of envs) for (const name of Object.keys(byEnv[env])) allVars.add(name);

		console.log();
		const header = `  ${"Variable".padEnd(30)} ${envs.map((e) => e.padEnd(30)).join(" ")}`;
		console.log(pc.bold(header));
		console.log(`  ${"-".repeat(header.length - 2)}`);

		for (const name of [...allVars].sort()) {
			const values = envs.map((e) => byEnv[e][name] ?? pc.dim("—"));
			const allSame = new Set(values).size === 1;
			const line = `  ${name.padEnd(30)} ${values.map((v) => String(v).padEnd(30)).join(" ")}`;
			console.log(allSame ? pc.dim(line) : line);
		}
	},
});
