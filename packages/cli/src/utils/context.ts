import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
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

export const PIN_ARGUMENT = {
	type: "string",
	description: "PIN for trusted non-interactive use (unsafe: visible in process arguments)",
} as const;

export const PIN_FILE_ARGUMENT = {
	type: "string",
	description: "Read the PIN from a file (preferred for trusted automation)",
} as const;

export const NEW_PIN_ARGUMENT = {
	type: "string",
	description: "New PIN for trusted non-interactive use (unsafe: visible in process arguments)",
} as const;

export const NEW_PIN_FILE_ARGUMENT = {
	type: "string",
	description: "Read the new PIN from a file",
} as const;
export const KEY_FILE_ARGUMENT = {
	type: "string",
	description: "Encrypted key envelope path (default: nearest .varskey)",
} as const;

export const KEY_CREDENTIAL_ARGUMENTS = {
	pin: PIN_ARGUMENT,
	"pin-file": PIN_FILE_ARGUMENT,
	"key-file": KEY_FILE_ARGUMENT,
} as const;

export interface KeyCredentials {
	pin?: string;
	pinFile?: string;
	/** Prefer the encrypted envelope even when the VARS_KEY compatibility fallback is set. */
	preferEnvelope?: boolean;
}

/** Preserve credential precedence consistently across every CLI command. */
export function keyCredentialsFromArgs(args: Record<string, unknown>): KeyCredentials {
	return {
		pin: typeof args.pin === "string" ? args.pin : undefined,
		pinFile: typeof args["pin-file"] === "string" ? args["pin-file"] : undefined,
		preferEnvelope: typeof args["key-file"] === "string",
	};
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
	const results = new Map<string, string>();
	const SKIP = new Set(["node_modules", ".git", "dist", ".vars"]);
	function walk(dir: string) {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (SKIP.has(entry.name)) continue;
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) walk(fullPath);
				else if (entry.name.endsWith(".vars") && !isLocalPath(entry.name)) {
					const canonical = toLockedPath(fullPath);
					if (isUnlockedPath(fullPath) || !results.has(canonical)) results.set(canonical, fullPath);
				}
			}
		} catch {
			/* permission error */
		}
	}
	walk(rootDir);
	return [...results.values()];
}

/** Find all .unlocked.vars files in a directory */
export function findUnlockedVarsFiles(rootDir: string): string[] {
	return findAllVarsFiles(rootDir).filter((f) => isUnlockedPath(f));
}

/** Find .varskey file, walking up from startDir */
export function findKeyFile(startDir: string): string | null {
	let dir = resolve(startDir);
	while (true) {
		const keyPath = join(dir, ".varskey");
		if (existsSync(keyPath)) return keyPath;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** Resolve an explicit encrypted key envelope or find the nearest .varskey. */
export function resolveKeyFile(startDir: string, suppliedPath?: string): string | null {
	const configuredPath = suppliedPath ?? process.env.VARS_KEY_FILE;
	return configuredPath ? resolve(configuredPath) : findKeyFile(startDir);
}

/** Get encryption key — from an explicit PIN source, environment, or prompt */
export async function requireKey(
	keyFilePath: string | null,
	command?: string,
	credentials: KeyCredentials = {},
): Promise<KeyResult> {
	const suppliedPin = resolveSuppliedPin(credentials);
	const envelopePreferred =
		credentials.preferEnvelope === true ||
		suppliedPin !== undefined ||
		process.env.VARS_KEY_FILE !== undefined;
	if (!envelopePreferred) {
		const envKey = getKeyFromEnv();
		if (envKey) return { key: envKey, scope: "master" };
	}

	if (!keyFilePath || !existsSync(keyFilePath)) {
		throw new Error("No encryption key found. Run `vars key init` first.");
	}

	const content = readFileSync(keyFilePath, "utf8").trim();
	const entries = parseKeyFile(content);

	if (entries.length === 0) {
		throw new Error("Key file is empty. Run `vars key init` first.");
	}

	// Explicit flags override environment credentials for this invocation.
	let pin = suppliedPin;
	if (!pin && process.stdin.isTTY) {
		const result = await prompts.password({ message: "Enter PIN:" });
		if (prompts.isCancel(result)) process.exit(0);
		pin = result as string;
	} else if (!pin) {
		const commandDesc = command ?? "vars (unknown command)";
		const agentPin = requestAgentApproval(commandDesc);
		if (!agentPin) {
			throw new Error(
				"PIN approval denied or no dialog available.\n" +
					"Provide the encrypted key envelope plus --pin-file or VARS_PIN_FILE.\n" +
					"Use VARS_KEY only for CI compatibility when an envelope cannot be provisioned.",
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

/** Resolve a non-interactive PIN without falling back to a human prompt. */
export function resolveSuppliedPin(credentials: KeyCredentials = {}): string | undefined {
	const explicit = resolveExplicitPin(credentials);
	if (explicit !== undefined) return explicit;
	if (process.env.VARS_PIN) return process.env.VARS_PIN;
	if (process.env.VARS_PIN_FILE) return readPinFile(process.env.VARS_PIN_FILE);
	return undefined;
}

/** Resolve only explicit PIN flags, excluding ambient environment credentials. */
export function resolveExplicitPin(credentials: KeyCredentials = {}): string | undefined {
	if (credentials.pin !== undefined) return credentials.pin;
	if (credentials.pinFile !== undefined) return readPinFile(credentials.pinFile);
	return undefined;
}

function readPinFile(path: string): string {
	const pin = readFileSync(resolve(path), "utf8").trim();
	if (!pin) throw new Error(`PIN file is empty: ${path}`);
	return pin;
}

/** Resolve environment name with common aliases */
export function resolveEnv(env: string): string {
	const aliases: Record<string, string> = {
		development: "dev",
		production: "prod",
	};
	return aliases[env] ?? env;
}

/** Find the nearest project root, walking up from startDir.
 *  Prefers the closest ancestor containing package.json (the current package in a
 *  monorepo), falling back to the git root, then to startDir/cwd.
 *
 *  The walk is bounded by the git root so we don't pick up an unrelated
 *  package.json that happens to sit above the repository (e.g. a personal
 *  `~/package.json`). */
export function getProjectRoot(startDir?: string): string {
	const resolved = resolve(startDir ?? process.cwd());
	// Normalize through the real filesystem path so the boundary comparison
	// below matches git's own (symlink-resolved) output on macOS/Linux.
	const start = existsSync(resolved) ? realpathSync(resolved) : resolved;
	const gitRoot = getGitRoot(start);
	let dir = start;
	while (true) {
		if (existsSync(join(dir, "package.json"))) return dir;
		if (gitRoot && dir === gitRoot) break;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	if (gitRoot) return gitRoot;
	return start;
}

/** Get the git repository root for git-scoped operations (e.g. hooks).
 *  Returns null if not in a git repository. */
export function getGitRoot(startDir?: string): string | null {
	try {
		return execSync("git rev-parse --show-toplevel", {
			cwd: startDir ?? process.cwd(),
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
	} catch {
		return null;
	}
}
