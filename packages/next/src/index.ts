import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvx, generateTypes, parse } from "@vars/core";

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
 * import { withEnvx } from '@vars/next'
 * export default withEnvx({ reactStrictMode: true })
 * ```
 */
export function withEnvx(
  nextConfig: Record<string, unknown> = {},
  varsOptions: VarsOptions = {},
): Record<string, unknown> {
  const envFile = varsOptions.envFile ?? ".vars";
  const env = varsOptions.env ?? process.env.VARS_ENV ?? "development";
  const key = varsOptions.key ?? process.env.VARS_KEY ?? readKeyFile(envFile);

  const envFilePath = resolve(process.cwd(), envFile);

  // 1. Auto-regenerate env.generated.ts if .vars changed
  regenerateIfStale(envFilePath, envFile);

  // 2. Load, decrypt, and validate
  const loadOptions: Record<string, unknown> = { env };
  if (key) loadOptions.key = key;

  const resolved = loadEnvx(envFilePath, loadOptions as { env?: string; key?: string });

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
  const existingEnv = (nextConfig.env as Record<string, string>) ?? {};

  return {
    ...nextConfig,
    ...(Object.keys(clientEnv).length > 0 || Object.keys(existingEnv).length > 0
      ? { env: { ...existingEnv, ...clientEnv } }
      : {}),
  };
}

/**
 * Extract the underlying value from a possibly-Redacted wrapper or primitive.
 */
function extractValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && typeof (value as { valueOf: () => unknown }).valueOf === "function") {
    const inner = (value as { valueOf: () => unknown }).valueOf();
    if (inner !== value) return String(inner);
  }
  return String(value);
}

/**
 * Read the key from .vars.key file if it exists.
 */
function readKeyFile(envFile: string): string | undefined {
  const keyPath = resolve(process.cwd(), `${envFile}.key`);
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf8").trim();
  }
  return undefined;
}

/**
 * Regenerate env.generated.ts if the .vars file is newer.
 */
function regenerateIfStale(envFilePath: string, envFile: string): void {
  if (!existsSync(envFilePath)) return;

  const generatedPath = resolve(dirname(envFilePath), "env.generated.ts");
  const varsModified = statSync(envFilePath).mtimeMs;

  if (existsSync(generatedPath)) {
    const genModified = statSync(generatedPath).mtimeMs;
    if (genModified >= varsModified) return; // up to date
  }

  // Parse and regenerate
  const content = readFileSync(envFilePath, "utf8");
  const parsed = parse(content);
  const generated = generateTypes(parsed, envFile);
  writeFileSync(generatedPath, generated, "utf8");
}
