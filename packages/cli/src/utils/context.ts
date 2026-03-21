import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface CliContext {
  varsFilePath: string;
  keyFilePath: string;
  env: string;
  cwd: string;
}

/**
 * Walk up from `startDir` looking for a `.vars` file.
 * Returns absolute path or null.
 */
export function findVarsFile(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (dir !== root) {
    const candidate = resolve(dir, ".vars");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Resolve the .vars.key file path relative to the .vars file.
 */
export function findKeyFile(varsFilePath: string): string {
  return resolve(dirname(varsFilePath), ".vars.key");
}

/** Map common long environment names to the short forms used in .vars files. */
const ENV_ALIASES: Record<string, string> = {
  development: "dev",
  production: "prod",
  staging: "staging",
  test: "test",
};

/**
 * Determine which environment to use.
 * Priority: --env flag > VARS_ENV env var > "dev"
 * Long names like "development" are automatically mapped to their short form.
 */
export function resolveEnv(flagEnv?: string): string {
  const raw = flagEnv ?? process.env.VARS_ENV ?? "dev";
  return ENV_ALIASES[raw] ?? raw;
}

/**
 * Build a full CLI context from options.
 */
export function buildContext(options: {
  file?: string;
  env?: string;
  cwd?: string;
}): CliContext {
  const cwd = options.cwd ?? process.cwd();
  const varsFilePath = options.file
    ? resolve(cwd, options.file)
    : findVarsFile(cwd) ?? resolve(cwd, ".vars");
  const keyFilePath = findKeyFile(varsFilePath);
  const env = resolveEnv(options.env);

  return { varsFilePath, keyFilePath, env, cwd };
}

/**
 * Read the raw key file contents (PIN-encrypted master key).
 */
export function readKeyFile(keyFilePath: string): string {
  if (!existsSync(keyFilePath)) {
    throw new Error(
      `Key file not found: ${keyFilePath}\nRun 'vars init' to create one, or set VARS_KEY env var for CI/CD.`,
    );
  }
  return readFileSync(keyFilePath, "utf8").trim();
}

/**
 * Try to get the master key: VARS_KEY env var > null (need PIN).
 */
export function getMasterKeyFromEnv(): Buffer | null {
  const envKey = process.env.VARS_KEY;
  if (envKey) {
    return Buffer.from(envKey, "base64");
  }
  return null;
}
