import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { generateTypes, loadEnvx, parse } from "@vars/core";

export interface VarsOptions {
	envFile?: string;
	env?: string;
	key?: string;
}

export interface CheckResult {
	file: string;
	ok: boolean;
	error?: string;
}

export interface GenResult {
	file: string;
	generated: string;
}

export interface DiffResult {
	onlyInA: string[];
	onlyInB: string[];
	shared: string[];
}

/**
 * Discover all .vars files in a Turborepo workspace.
 * Reads pnpm-workspace.yaml to find workspace packages,
 * then checks each for a .vars file.
 */
export function discoverWorkspaceVarsFiles(rootDir: string): string[] {
	const workspaceFile = resolve(rootDir, "pnpm-workspace.yaml");
	if (!existsSync(workspaceFile)) return [];

	const content = readFileSync(workspaceFile, "utf8");
	const globs = parseWorkspaceGlobs(content);
	const varsFiles: string[] = [];

	// Check root .vars
	const rootVars = resolve(rootDir, ".vars");
	if (existsSync(rootVars)) {
		varsFiles.push(rootVars);
	}

	// Check each workspace pattern
	for (const glob of globs) {
		// Handle "apps/*", "packages/*" style globs
		const parts = glob.replace(/['"]/g, "").split("/");
		if (parts.length < 2 || parts[parts.length - 1] !== "*") continue;

		const baseDir = resolve(rootDir, parts.slice(0, -1).join("/"));
		if (!existsSync(baseDir)) continue;

		try {
			const entries = readdirSync(baseDir, { withFileTypes: true });
			for (const entry of entries) {
				if (typeof entry === "object" && "isDirectory" in entry && entry.isDirectory()) {
					const varsPath = resolve(baseDir, entry.name, ".vars");
					if (existsSync(varsPath)) {
						varsFiles.push(varsPath);
					}
				}
			}
		} catch {
			// Directory doesn't exist or can't be read
		}
	}

	return varsFiles;
}

/**
 * Validate all .vars files in the workspace.
 * Equivalent to `vars check --all`.
 */
export function checkAll(rootDir: string, options: VarsOptions = {}): CheckResult[] {
	const files = discoverWorkspaceVarsFiles(rootDir);
	const results: CheckResult[] = [];

	for (const file of files) {
		try {
			const env = options.env ?? process.env.VARS_ENV ?? "development";
			const keyPath = `${file}.key`;
			let key = options.key ?? process.env.VARS_KEY;
			if (!key && existsSync(keyPath)) {
				key = readFileSync(keyPath, "utf8").trim();
			}
			const loadOptions: Record<string, unknown> = { env };
			if (key) loadOptions.key = key;

			loadEnvx(file, loadOptions as { env?: string; key?: string });
			results.push({ file: relative(rootDir, file), ok: true });
		} catch (err) {
			results.push({
				file: relative(rootDir, file),
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

/**
 * Generate env.generated.ts for all .vars files in the workspace.
 * Equivalent to `vars gen --all`.
 */
export function genAll(rootDir: string): GenResult[] {
	const files = discoverWorkspaceVarsFiles(rootDir);
	const results: GenResult[] = [];

	for (const file of files) {
		try {
			const content = readFileSync(file, "utf8");
			const parsed = parse(content);
			const envFile = basename(file);
			const generated = generateTypes(parsed, envFile);
			const generatedPath = resolve(dirname(file), "env.generated.ts");

			writeFileSync(generatedPath, generated, "utf8");
			results.push({ file: relative(rootDir, file), generated: generatedPath });
		} catch (err) {
			results.push({
				file: relative(rootDir, file),
				generated: "",
			});
		}
	}

	return results;
}

/**
 * Compare variables between two apps' .vars files.
 * Equivalent to `vars diff --app web --app api`.
 */
export function diffApps(fileA: string, fileB: string): DiffResult {
	const contentA = readFileSync(fileA, "utf8");
	const contentB = readFileSync(fileB, "utf8");

	const parsedA = parse(contentA);
	const parsedB = parse(contentB);

	const namesA = new Set(parsedA.variables.map((v) => v.name));
	const namesB = new Set(parsedB.variables.map((v) => v.name));

	const onlyInA: string[] = [];
	const onlyInB: string[] = [];
	const shared: string[] = [];

	for (const name of namesA) {
		if (namesB.has(name)) {
			shared.push(name);
		} else {
			onlyInA.push(name);
		}
	}

	for (const name of namesB) {
		if (!namesA.has(name)) {
			onlyInB.push(name);
		}
	}

	return { onlyInA, onlyInB, shared };
}

/**
 * Parse workspace globs from pnpm-workspace.yaml content.
 * Handles simple YAML: `packages:\n  - "apps/*"\n  - "packages/*"`
 */
function parseWorkspaceGlobs(content: string): string[] {
	const globs: string[] = [];
	const lines = content.split("\n");
	let inPackages = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "packages:" || trimmed.startsWith("packages:")) {
			inPackages = true;
			continue;
		}
		if (inPackages) {
			if (trimmed.startsWith("- ")) {
				globs.push(trimmed.slice(2).replace(/['"]/g, "").trim());
			} else if (trimmed !== "" && !trimmed.startsWith("#")) {
				// New top-level key, stop parsing
				break;
			}
		}
	}

	return globs;
}
