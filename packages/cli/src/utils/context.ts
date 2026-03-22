import { resolve, dirname, join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { getKeyFromEnv, decryptMasterKey } from "@vars/node";
import * as prompts from "@clack/prompts";

export interface CliContext {
  varsFilePath: string;
  keyFilePath: string | null;
  env: string;
  projectRoot: string;
}

/** Find the nearest .vars file, walking up from startDir */
export function findVarsFile(startDir: string, fileName?: string): string | null {
  if (fileName) {
    const abs = resolve(startDir, fileName);
    return existsSync(abs) ? abs : null;
  }
  let dir = resolve(startDir);
  while (true) {
    try {
      const files = readdirSync(dir).filter(f => f.endsWith(".vars") && !f.startsWith("."));
      if (files.length > 0) return resolve(dir, files[0]);
    } catch { /* permission error, skip */ }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Find all .vars files recursively in a directory */
export function findAllVarsFiles(rootDir: string): string[] {
  const results: string[] = [];
  const SKIP = new Set(["node_modules", ".git", "dist", ".vars"]);
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.name.endsWith(".vars")) results.push(fullPath);
      }
    } catch { /* permission error */ }
  }
  walk(rootDir);
  return results;
}

/** Find .vars/key file, walking up from startDir */
export function findKeyFile(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    const keyPath = join(dir, ".vars", "key");
    if (existsSync(keyPath)) return keyPath;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Get encryption key — from env var or by prompting for PIN */
export async function requireKey(keyFilePath: string | null): Promise<Buffer> {
  const envKey = getKeyFromEnv();
  if (envKey) return envKey;
  if (!keyFilePath || !existsSync(keyFilePath)) {
    throw new Error("No encryption key found. Run `vars key init` first.");
  }
  const encoded = readFileSync(keyFilePath, "utf8").trim();
  const pin = await prompts.password({ message: "Enter PIN:" });
  if (prompts.isCancel(pin)) process.exit(0);
  return decryptMasterKey(encoded, pin as string);
}

/** Resolve environment name with common aliases */
export function resolveEnv(env: string): string {
  const aliases: Record<string, string> = {
    development: "dev",
    production: "prod",
  };
  return aliases[env] ?? env;
}

/** Get the git root directory */
export function getProjectRoot(startDir?: string): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: startDir ?? process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return startDir ?? process.cwd();
  }
}
