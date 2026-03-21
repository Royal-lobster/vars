import { resolve } from "node:path";
import { extractValue, loadVars, regenerateIfStale, resolveVarsFile } from "@vars/core";

export interface VarsOptions {
	envFile?: string;
	env?: string;
	key?: string;
}

/**
 * Wraps a Next.js config with vars integration.
 * Decrypts .vars, validates with Zod, injects into process.env,
 * and splits NEXT_PUBLIC_* vars for client bundle.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withVars } from '@vars/next'
 * export default withVars({ reactStrictMode: true })
 * ```
 */
export function withVars<T extends object>(
	nextConfig: T = {} as T,
	varsOptions: VarsOptions = {},
): T {
	const envFile = varsOptions.envFile ?? ".vars/vault.vars";
	const env = varsOptions.env ?? process.env.VARS_ENV ?? "development";
	const { path: envFilePath, unlocked } = resolveVarsFile(envFile);
	const key = unlocked ? undefined : (varsOptions.key ?? process.env.VARS_KEY);

	// 1. Auto-regenerate vars.generated.ts if .vars changed
	regenerateIfStale(envFilePath, envFile);

	// 2. Load, decrypt, and validate
	const loadOptions: Record<string, unknown> = { env };
	if (key) loadOptions.key = key;

	let resolved: Record<string, unknown>;
	try {
		resolved = loadVars(envFilePath, loadOptions as { env?: string; key?: string });
	} catch (err) {
		throw new Error(`[@vars/next] Failed to load ${envFile}: ${(err as Error).message}`);
	}

	// 3. Inject all vars into process.env
	const clientEnv: Record<string, string> = {};

	for (const [name, value] of Object.entries(resolved)) {
		const raw = extractValue(value);
		process.env[name] = raw;

		// 4. Collect NEXT_PUBLIC_* for client bundle
		if (name.startsWith("NEXT_PUBLIC_")) {
			clientEnv[name] = raw;
		}
	}

	// 5. Merge into Next.js config
	const existingEnv = ((nextConfig as Record<string, unknown>).env as Record<string, string>) ?? {};

	return {
		...nextConfig,
		...(Object.keys(clientEnv).length > 0 || Object.keys(existingEnv).length > 0
			? { env: { ...existingEnv, ...clientEnv } }
			: {}),
	} as T;
}
