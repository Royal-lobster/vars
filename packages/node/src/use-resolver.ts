import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, resolveAll } from "@dotvars/core";
import type { Check, Declaration, Import, Param, ResolvedVars } from "@dotvars/core";
import { isLocalPath, isUnlockedPath, toLocalPath, toUnlockedPath } from "./unlocked-path.js";

export interface UseResolveOptions {
	env: string;
	params?: Record<string, string>;
}

export function resolveUseChain(filePath: string, options: UseResolveOptions): ResolvedVars {
	const visited = new Set<string>();
	const absPath = resolve(filePath);

	const merged = resolveFile(absPath, visited);

	// Merge local overrides (top-level only — imported files don't get local overlays)
	const localOverrides = mergeLocalFile(absPath, merged, visited);

	const resolved = resolveAll(
		localOverrides.declarations,
		options.env,
		options.params ?? {},
		localOverrides.envs,
		localOverrides.params,
	);

	// Inject source files collected during the chain walk
	resolved.sourceFiles = localOverrides.sourceFiles;

	return resolved;
}

// ── Internal types ───────────────────────────────────────────────────────────

function mergeLocalFile(basePath: string, base: MergedFile, baseVisited: Set<string>): MergedFile {
	// Don't look for local files of local files
	if (isLocalPath(basePath)) return base;

	const localPath = toLocalPath(basePath);
	if (!existsSync(localPath)) return base;

	// Resolve the local file through the normal resolver (handles use imports).
	// Inherit the base chain's visited set so circular-import guards stay consistent.
	const localMerged = resolveFile(localPath, new Set(baseVisited));

	// Warn and discard env() declarations from local file
	if (localMerged.envs.length > 0) {
		console.warn(`⚠ ${localPath}: env() declaration ignored (inherited from base file)`);
	}

	// Warn and discard param declarations from local file
	for (const param of localMerged.params) {
		console.warn(`⚠ ${localPath}: param "${param.name}" ignored (inherited from base file)`);
	}

	// Local declarations shadow base declarations (same semantics as use shadowing)
	const localNames = new Set(localMerged.declarations.map(getDeclName));
	const mergedDecls: Declaration[] = [];

	for (const decl of base.declarations) {
		if (!localNames.has(getDeclName(decl))) {
			mergedDecls.push(decl);
		}
	}
	mergedDecls.push(...localMerged.declarations);

	return {
		envs: base.envs,
		params: base.params,
		declarations: mergedDecls,
		checks: [...base.checks, ...localMerged.checks],
		sourceFiles: [...base.sourceFiles, ...localMerged.sourceFiles],
	};
}

interface MergedFile {
	envs: string[];
	params: Param[];
	declarations: Declaration[];
	checks: Check[];
	sourceFiles: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDeclName(decl: Declaration): string {
	return decl.name;
}

function filterDeclarations(declarations: Declaration[], filter: Import["filter"]): Declaration[] {
	if (!filter) return declarations;

	if (filter.kind === "pick") {
		return declarations.filter((d) => filter.names.includes(getDeclName(d)));
	}

	// omit
	return declarations.filter((d) => !filter.names.includes(getDeclName(d)));
}

// ── Core recursive resolver ──────────────────────────────────────────────────

function resolveFile(absPath: string, visited: Set<string>): MergedFile {
	if (visited.has(absPath)) {
		throw new Error(`Circular use detected: ${absPath}`);
	}
	visited.add(absPath);

	const content = readFileSync(absPath, "utf8");
	const result = parse(content, absPath);
	const ast = result.ast;

	// Collect all imported declarations, tracking source for conflict reporting
	const importedDecls: Map<string, { decl: Declaration; source: string }> = new Map();
	const importedSourceFiles: string[] = [];

	for (const imp of ast.imports) {
		let importPath = resolve(dirname(absPath), imp.path);
		// Try unlocked variant if locked path doesn't exist
		if (!existsSync(importPath) && !isUnlockedPath(importPath)) {
			const unlockedPath = toUnlockedPath(importPath);
			if (existsSync(unlockedPath)) {
				importPath = unlockedPath;
			}
		}
		// Pass a copy of visited so siblings don't block each other
		const imported = resolveFile(importPath, new Set(visited));

		// Collect transitively gathered source files
		importedSourceFiles.push(...imported.sourceFiles);

		// Apply pick/omit filter
		let filteredDecls = imported.declarations;
		if (imp.filter) {
			filteredDecls = filterDeclarations(imported.declarations, imp.filter);
		}

		// Check for conflicts between parallel imports
		for (const decl of filteredDecls) {
			const name = getDeclName(decl);
			if (importedDecls.has(name)) {
				throw new Error(
					`"${name}" is defined in both ${importedDecls.get(name)!.source} and ${importPath} — use pick/omit to resolve`,
				);
			}
			importedDecls.set(name, { decl, source: importPath });
		}
	}

	// Local declarations shadow imports
	const localNames = new Set(ast.declarations.map(getDeclName));
	const mergedDecls: Declaration[] = [];

	for (const [name, { decl }] of importedDecls) {
		if (!localNames.has(name)) {
			mergedDecls.push(decl);
		}
	}
	mergedDecls.push(...ast.declarations);

	return {
		envs: ast.envs,
		params: ast.params,
		declarations: mergedDecls,
		checks: [...ast.checks],
		sourceFiles: [absPath, ...importedSourceFiles],
	};
}
