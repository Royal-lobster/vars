import type { ResolvedVars } from "./types.js";

export function generateServerless(byEnv: Record<string, ResolvedVars>): string {
	const envNames = Object.keys(byEnv);
	if (envNames.length === 0) throw new Error("generateServerless: no envs provided");

	// Assume all envs share the same variable set; use the first as reference.
	const ref = byEnv[envNames[0]];
	const publicVars = ref.vars.filter((v) => v.public);
	const secretVars = ref.vars.filter((v) => !v.public);

	const lines: string[] = [];

	// PUBLIC_VARS block — literal values, identical across envs.
	lines.push("const PUBLIC_VARS = {");
	for (const v of publicVars) {
		lines.push(`  ${v.name}: ${JSON.stringify(v.value)},`);
	}
	lines.push("} as const;");
	lines.push("");

	// CIPHERTEXTS block — per-env ciphertext tokens.
	lines.push("const CIPHERTEXTS = {");
	for (const env of envNames) {
		lines.push(`  ${JSON.stringify(env)}: {`);
		for (const v of secretVars) {
			const val = byEnv[env].vars.find((x) => x.name === v.name)?.value;
			lines.push(`    ${v.name}: ${JSON.stringify(val ?? "")},`);
		}
		lines.push("  },");
	}
	lines.push("} as const;");

	return lines.join("\n");
}
