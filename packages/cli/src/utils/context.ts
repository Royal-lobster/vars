import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as prompts from "@clack/prompts";
import type { KeyScope } from "@dotvars/node";
import { decryptMasterKey, getKeyFromEnv, parseKeyFile } from "@dotvars/node";
import {
	isLocalPath,
	isUnlockedPath,
	toCanonicalPath,
	toLockedPath,
	toUnlockedPath,
} from "@dotvars/node";
import { requestAgentApproval } from "./agent-auth.js";

export interface KeyResult {
	key: Buffer;
	scope: KeyScope;
}

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
		if (existsSync(abs)) return abs;
		// Try the other variant
		if (isUnlockedPath(abs)) {
			const locked = toCanonicalPath(abs);
			if (existsSync(locked)) return locked;
		} else {
			const unlocked = toUnlockedPath(abs);
			if (existsSync(unlocked)) return unlocked;
		}
		return null;
	}
	let dir = resolve(startDir);
	while (true) {
		try {
			const files = readdirSync(dir).filter(
				(f) => f.endsWith(".vars") && !f.startsWith(".") && !isLocalPath(f),
			);
			// Prefer .unlocked.vars over .vars (most recent state), but deduplicate
			const seen = new Set<string>();
			const result: string[] = [];
			for (const f of files) {
				const canonical = isUnlockedPath(f) ? toLockedPath(f) : f;
				if (!seen.has(canonical)) {
					seen.add(canonical);
					// Prefer unlocked variant if it exists
					const unlockedName = toUnlockedPath(canonical);
					if (files.includes(unlockedName)) {
						result.push(resolve(dir, unlockedName));
					} else {
						result.push(resolve(dir, f));
					}
				}
			}
			if (result.length > 0) return result[0];
		} catch {
			/* permission error, skip */
		}
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
				else if (entry.name.endsWith(".vars") && !isLocalPath(entry.name)) results.push(fullPath);
			}
		} catch {
			/* permission error */
		}
	}
	walk(rootDir);
	return results;
}

/** Find all .unlocked.vars files in a directory */
export function findUnlockedVarsFiles(rootDir: string): string[] {
	return findAllVarsFiles(rootDir).filter((f) => isUnlockedPath(f));
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
export async function requireKey(keyFilePath: string | null, command?: string): Promise<KeyResult> {
	// First: try VARS_KEY env var (works in CI/non-TTY)
	const envKey = getKeyFromEnv();
	if (envKey) return { key: envKey, scope: "master" };

	if (!keyFilePath || !existsSync(keyFilePath)) {
		throw new Error("No encryption key found. Run `vars key init` first.");
	}

	const content = readFileSync(keyFilePath, "utf8").trim();
	const entries = parseKeyFile(content);

	if (entries.length === 0) {
		throw new Error("Key file is empty. Run `vars key init` first.");
	}

	// Get PIN
	let pin: string;
	const envPin = process.env.VARS_PIN;
	if (envPin) {
		pin = envPin;
	} else if (process.stdin.isTTY) {
		const result = await prompts.password({ message: "Enter PIN:" });
		if (prompts.isCancel(result)) process.exit(0);
		pin = result as string;
	} else {
		const commandDesc = command ?? "vars (unknown command)";
		const agentPin = requestAgentApproval(commandDesc);
		if (!agentPin) {
			throw new Error(
				"PIN approval denied or no dialog available.\n" +
					"Set VARS_KEY environment variable with your base64-encoded master key.\n" +
					"Get it with: vars key export",
			);
		}
		pin = agentPin;
	}

	// Try each entry in the key file
	for (const entry of entries) {
		try {
			const key = await decryptMasterKey(entry.raw, pin);
			const scope: KeyScope =
				entry.scope === "master" ? "master" : { owner: entry.scope.replace("owner:", "") };
			return { key, scope };
		} catch {
			// Wrong PIN for this entry, try next
		}
	}

	throw new Error("Invalid PIN");
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
