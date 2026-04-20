import type { ResolvedVars } from "@dotvars/core";
import { resolveUseChain } from "./use-resolver.js";

export function resolveAllEnvs(filePath: string): Record<string, ResolvedVars> {
	// First pass to discover the env list.
	const first = resolveUseChain(filePath, { env: "__vars_probe__" });
	const envs = first.envs;
	if (envs.length === 0) {
		throw new Error("vars: file declares no environments");
	}
	if (envs.includes("__vars_probe__")) {
		throw new Error(`${filePath}: env name "__vars_probe__" is reserved`);
	}
	const out: Record<string, ResolvedVars> = {};
	for (const env of envs) {
		out[env] = resolveUseChain(filePath, { env });
	}
	return out;
}
