import { resolve } from "node:path";
import { extractValue, loadVars, readKeyFile, regenerateIfStale } from "@vars/core";
import type { Plugin } from "vite";

export interface VarsOptions {
	envFile?: string;
	env?: string;
	key?: string;
}

/**
 * Vite plugin for vars. Replaces `import.meta.env.VITE_*` at build time.
 * Also works for SvelteKit, Nuxt (via Vite plugin layer), and Remix.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { varsPlugin } from '@vars/vite'
 * export default defineConfig({
 *   plugins: [varsPlugin()],
 * })
 * ```
 */
export function varsPlugin(options: VarsOptions = {}): Plugin {
	const envFile = options.envFile ?? ".vars/vault.vars";
	let resolvedVars: Record<string, unknown> = {};

	function loadVars(): Record<string, unknown> {
		const env = options.env ?? process.env.VARS_ENV ?? "development";
		const key = options.key ?? process.env.VARS_KEY ?? readKeyFile(envFile);
		const envFilePath = resolve(process.cwd(), envFile);

		// Auto-regenerate env.generated.ts if .vars changed
		regenerateIfStale(envFilePath, envFile);

		const loadOptions: Record<string, unknown> = { env };
		if (key) loadOptions.key = key;

		try {
			return loadVars(envFilePath, loadOptions as { env?: string; key?: string });
		} catch (err) {
			throw new Error(`[@vars/vite] Failed to load ${envFile}: ${(err as Error).message}`);
		}
	}

	return {
		name: "vars",

		config() {
			resolvedVars = loadVars();
			const define: Record<string, string> = {};

			for (const [name, value] of Object.entries(resolvedVars)) {
				const raw = extractValue(value);

				// Inject ALL vars into process.env for server-side
				process.env[name] = raw;

				// Only VITE_* vars get import.meta.env replacements (client-safe)
				if (name.startsWith("VITE_")) {
					if (typeof value === "boolean") {
						define[`import.meta.env.${name}`] = String(value);
					} else if (typeof value === "number") {
						define[`import.meta.env.${name}`] = String(value);
					} else {
						define[`import.meta.env.${name}`] = JSON.stringify(raw);
					}
				}
			}

			return { define };
		},

		configureServer(server) {
			const envFilePath = resolve(process.cwd(), envFile);
			server.watcher.add(envFilePath);
			server.watcher.on("change", (changedPath: string) => {
				if (resolve(changedPath) === envFilePath) {
					resolvedVars = loadVars();
					server.restart(); // Force Vite to re-evaluate config with new define values
				}
			});
		},
	};
}
