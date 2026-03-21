import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvx, generateTypes, parse } from "@vars/core";

export interface VarsOptions {
  envFile?: string;
  env?: string;
  key?: string;
}

export interface AstroIntegration {
  name: string;
  hooks: {
    "astro:config:setup": (options: {
      config: Record<string, unknown>;
      updateConfig: (config: Record<string, unknown>) => void;
    }) => void;
  };
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
        const envFile = options.envFile ?? ".vars";
        const env = options.env ?? process.env.VARS_ENV ?? "development";
        const key = options.key ?? process.env.VARS_KEY ?? readKeyFile(envFile);
        const envFilePath = resolve(process.cwd(), envFile);

        // Auto-regenerate env.generated.ts if .vars changed
        regenerateIfStale(envFilePath, envFile);

        // Load, decrypt, validate
        const loadOptions: Record<string, unknown> = { env };
        if (key) loadOptions.key = key;

        const resolved = loadEnvx(envFilePath, loadOptions as { env?: string; key?: string });

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

function extractValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && typeof (value as { valueOf: () => unknown }).valueOf === "function") {
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
