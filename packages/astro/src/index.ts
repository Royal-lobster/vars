import { resolve } from "node:path";
import { extractValue, loadEnvx, readKeyFile, regenerateIfStale } from "@vars/core";
import type { AstroIntegration } from "astro";

export interface VarsOptions {
	envFile?: string;
	env?: string;
	key?: string;
}

/**
 * Astro integration for vars. Hooks into `astro:config:setup`,
 * decrypts .vars, validates, injects into process.env, and
 * splits PUBLIC_* vars for client-side access.
 *
 * @example
 * ```ts
 * // astro.config.mts
 * import { varsIntegration } from '@vars/astro'
 * export default defineConfig({
 *   integrations: [varsIntegration()],
 * })
 * ```
 */
export function varsIntegration(options: VarsOptions = {}): AstroIntegration {
	return {
		name: "vars",
		hooks: {
			"astro:config:setup"({ updateConfig }) {
				const envFile = options.envFile ?? ".vars/vault.vars";
				const env = options.env ?? process.env.VARS_ENV ?? "development";
				const key = options.key ?? process.env.VARS_KEY ?? readKeyFile(envFile);
				const envFilePath = resolve(process.cwd(), envFile);

				// Auto-regenerate env.generated.ts if .vars changed
				regenerateIfStale(envFilePath, envFile);

				// Load, decrypt, validate
				const loadOptions: Record<string, unknown> = { env };
				if (key) loadOptions.key = key;

				let resolved: Record<string, unknown>;
				try {
					resolved = loadEnvx(envFilePath, loadOptions as { env?: string; key?: string });
				} catch (err) {
					throw new Error(`[@vars/astro] Failed to load ${envFile}: ${(err as Error).message}`);
				}

				// Inject all vars into process.env
				const publicDefines: Record<string, string> = {};

				for (const [name, value] of Object.entries(resolved)) {
					const raw = extractValue(value);
					process.env[name] = raw;

					// Collect PUBLIC_* for client-side Vite define
					if (name.startsWith("PUBLIC_")) {
						publicDefines[`import.meta.env.${name}`] = JSON.stringify(raw);
					}
				}

				// Update Astro config with client-safe defines
				if (Object.keys(publicDefines).length > 0) {
					updateConfig({
						vite: {
							define: publicDefines,
						},
					});
				}
			},
		},
	};
}
