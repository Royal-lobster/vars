import type { ResolvedVars } from "@dotvars/core";
import { resolveUseChain } from "./use-resolver.js";

export function resolveAllEnvs(filePath: string): Record<string, ResolvedVars> {
  // First pass to discover the env list.
  const first = resolveUseChain(filePath, { env: "__vars_probe__" });
  const envs = first.envs;
  if (envs.length === 0) {
    throw new Error("vars: file declares no environments");
  }
  const out: Record<string, ResolvedVars> = {};
  for (const env of envs) {
    out[env] = resolveUseChain(filePath, { env });
  }
  return out;
}
