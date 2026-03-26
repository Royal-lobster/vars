import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "./patterns.js";

export interface DefinitionContext {
	text: string;
	line: number;
	character: number;
	uri: string;
}

export interface DefinitionResult {
	targetUri: string;
	targetRange: { startLine: number; startChar: number; endLine: number; endChar: number };
	originRange: { startLine: number; startChar: number; endLine: number; endChar: number };
}

/**
 * Compute go-to-definition for a position in a .vars document.
 * Supports `use "path"` import resolution.
 */
export function computeDefinition(ctx: DefinitionContext): DefinitionResult | null {
	const result = parseDocument(ctx.text);

	// Check if cursor is on a `use` import line
	for (const imp of result.ast.imports) {
		if (imp.line === ctx.line + 1) {
			// AST is 1-indexed
			const targetUri = resolveUri(ctx.uri, imp.path);

			return {
				targetUri,
				targetRange: {
					startLine: 0,
					startChar: 0,
					endLine: 0,
					endChar: 0,
				},
				originRange: {
					startLine: ctx.line,
					startChar: 0,
					endLine: ctx.line,
					endChar: (ctx.text.split("\n")[ctx.line] ?? "").length,
				},
			};
		}
	}

	return null;
}

/**
 * Resolve a relative path against a file URI.
 * file:///project/apps/web/.vars + ../../.vars = file:///project/.vars
 */
function resolveUri(baseUri: string, relativePath: string): string {
	const basePath = fileURLToPath(baseUri);
	const baseDir = dirname(basePath);
	const resolved = resolve(baseDir, relativePath);
	return pathToFileURL(resolved).href;
}
