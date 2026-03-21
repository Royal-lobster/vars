import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { decryptMasterKey } from "@vars/core";
import { promptPIN } from "./prompt.js";

export interface CliContext {
  varsFilePath: string;
  keyFilePath: string;
  env: string;
  cwd: string;
}

/**
 * Walk up from `startDir` looking for a `.vars` file.
 * Also checks for `.vars.unlocked` (active show mode) and returns
 * the base `.vars` path regardless, so commands always reference the canonical name.
 */
export function findVarsFile(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (dir !== root) {
    const candidate = resolve(dir, ".vars");
    if (existsSync(candidate)) return candidate;
    // If .vars.unlocked exists, we're in show mode — return the base .vars path
    const decrypted = resolve(dir, ".vars.unlocked");
    if (existsSync(decrypted)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Resolve the varskey file path relative to the .vars file.
 */
export function findKeyFile(varsFilePath: string): string {
  return resolve(dirname(varsFilePath), "varskey");
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
 * Try to get the key without prompting. Returns null if unavailable.
 * Only checks VARS_KEY env var — no PIN prompt, no keychain.
 */
export function getKeyFromEnv(): Buffer | null {
  const envKey = process.env.VARS_KEY;
  if (envKey) {
    return Buffer.from(envKey, "base64");
  }
  return null;
}

/**
 * Resolve the encryption key. Prompts for PIN every time.
 * Priority: VARS_KEY env var (for CI/CD) > PIN prompt.
 * The key is never cached — human must authenticate each time.
 */
export async function requireKey(ctx?: CliContext): Promise<Buffer> {
  // CI/CD escape hatch
  const envKey = process.env.VARS_KEY;
  if (envKey) {
    return Buffer.from(envKey, "base64");
  }

  // Find the key file
  const keyFilePath = ctx?.keyFilePath ?? findKeyFile(
    findVarsFile() ?? resolve(process.cwd(), ".vars"),
  );
  const encoded = readKeyFile(keyFilePath);

  // Prompt for PIN and decrypt
  const pin = await promptPIN("Enter PIN");
  return decryptMasterKey(encoded, pin);
}
