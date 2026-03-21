import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateTypes, loadEnvx, parse } from "@vars/core";
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
	const envFile = options.envFile ?? ".vars";
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
			return loadEnvx(envFilePath, loadOptions as { env?: string; key?: string });
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

function extractValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (
		typeof value === "object" &&
		typeof (value as { valueOf: () => unknown }).valueOf === "function"
	) {
		const inner = (value as { valueOf: () => unknown }).valueOf();
		if (inner !== value) return String(inner);
	}
	return String(value);
}

function readKeyFile(envFile: string): string | undefined {
	const keyPath = resolve(process.cwd(), `${envFile}.key`);
	if (existsSync(keyPath)) {
		return readFileSync(keyPath, "utf8").trim();
	}
	return undefined;
}

function regenerateIfStale(envFilePath: string, envFile: string): void {
	if (!existsSync(envFilePath)) return;

	const generatedPath = resolve(dirname(envFilePath), "env.generated.ts");
	const varsModified = statSync(envFilePath).mtimeMs;

	if (existsSync(generatedPath)) {
		const genModified = statSync(generatedPath).mtimeMs;
		if (genModified >= varsModified) return;
	}

	const content = readFileSync(envFilePath, "utf8");
	const parsed = parse(content);
	const generated = generateTypes(parsed, envFile);
	writeFileSync(generatedPath, generated, "utf8");
}
