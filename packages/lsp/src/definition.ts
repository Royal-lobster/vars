import { posix as path } from "node:path";

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
 * Currently supports @extends path resolution.
 */
export function computeDefinition(ctx: DefinitionContext): DefinitionResult | null {
	const lines = ctx.text.split("\n");
	const currentLine = lines[ctx.line] ?? "";

	// Only handle @extends lines
	const extendsMatch = currentLine.match(/^@extends\s+(.+)$/);
	if (!extendsMatch) return null;

	const extendsPath = extendsMatch[1].trim();
	const pathStart = currentLine.indexOf(extendsPath);
	const pathEnd = pathStart + extendsPath.length;

	// Resolve the target URI relative to the current file
	const targetUri = resolveUri(ctx.uri, extendsPath);

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
			startChar: pathStart,
			endLine: ctx.line,
			endChar: pathEnd,
		},
	};
}

/**
 * Resolve a relative path against a file URI.
 * file:///project/apps/web/.vars + ../../.vars = file:///project/.vars
 */
function resolveUri(baseUri: string, relativePath: string): string {
	// Strip the file:// protocol and filename to get the directory
	const isFileUri = baseUri.startsWith("file://");
	const basePath = isFileUri ? baseUri.slice("file://".length) : baseUri;
	const baseDir = basePath.substring(0, basePath.lastIndexOf("/"));

	// Resolve the relative path
	const resolved = path.resolve(baseDir, relativePath);

	return isFileUri ? `file://${resolved}` : resolved;
}
