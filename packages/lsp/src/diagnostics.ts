import { fileURLToPath } from "node:url";
import { parse } from "@vars/core";
import type { Variable, VarsFile } from "@vars/core";
import { type Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node.js";
import { evaluateSchema } from "./zod-introspect.js";

/**
 * Compute all diagnostics for a .vars document.
 * Returns an array of LSP Diagnostics with source tags for filtering.
 */
export function computeDiagnostics(text: string, uri: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const lines = text.split("\n");

	// Convert LSP document URI (file://...) to a filesystem path for the parser
	const filePath = uri.startsWith("file://") ? fileURLToPath(uri) : uri;

	// Parse the file — collect parse errors as diagnostics
	let parsed: VarsFile;
	try {
		parsed = parse(text, filePath);
	} catch (err: unknown) {
		// If the parser throws, report a single parse error
		diagnostics.push({
			severity: DiagnosticSeverity.Error,
			range: Range.create(0, 0, 0, (lines[0] ?? "").length),
			message: err instanceof Error ? err.message : String(err),
			source: "vars-parse",
		});
		return diagnostics;
	}

	// Schema validation — eval each variable's Zod schema with real Zod
	for (const variable of parsed.variables) {
		const lineIndex = variable.line - 1; // Convert 1-based to 0-based
		const result = evaluateSchema(variable.schema);
		if (!result.success) {
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: lineRange(lines, lineIndex, variable.schema),
				message: `Invalid schema: ${result.error}`,
				source: "vars-schema",
			});
		}

		// Check metadata
		checkMetadata(variable, lineIndex, lines, diagnostics);
	}

	// @refine reference checking
	checkRefineReferences(parsed, lines, diagnostics);

	return diagnostics;
}

/**
 * Check @refine expressions for references to undefined variables.
 * Extracts `env.VARNAME` patterns and verifies each against declared variables.
 */
function checkRefineReferences(parsed: VarsFile, lines: string[], diagnostics: Diagnostic[]): void {
	const declaredNames = new Set(parsed.variables.map((v) => v.name));

	for (const refine of parsed.refines) {
		const lineIndex = refine.line - 1;
		// Extract env.VARNAME references
		const refPattern = /env\.([A-Z_][A-Z0-9_]*)/g;
		const matches = refine.expression.matchAll(refPattern);

		for (const match of matches) {
			const varName = match[1];
			if (!declaredNames.has(varName)) {
				diagnostics.push({
					severity: DiagnosticSeverity.Error,
					range: lineRange(lines, lineIndex, `env.${varName}`),
					message: `@refine references undefined variable: ${varName}`,
					source: "vars-refine",
				});
			}
		}
	}
}

/**
 * Check variable metadata for deprecation warnings and expiry.
 */
function checkMetadata(
	variable: Variable,
	lineIndex: number,
	lines: string[],
	diagnostics: Diagnostic[],
): void {
	const { metadata } = variable;

	if (metadata.deprecated) {
		diagnostics.push({
			severity: DiagnosticSeverity.Warning,
			range: lineRange(lines, lineIndex, variable.name),
			message: `Deprecated: ${metadata.deprecated}`,
			source: "vars-deprecated",
		});
	}

	if (metadata.expires) {
		const expiryDate = new Date(metadata.expires);
		const now = new Date();
		if (expiryDate < now) {
			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range: lineRange(lines, lineIndex, variable.name),
				message: `Secret expired on ${metadata.expires} — rotate this value`,
				source: "vars-expires",
			});
		} else {
			// Warn if expiring within 30 days
			const thirtyDays = 30 * 24 * 60 * 60 * 1000;
			if (expiryDate.getTime() - now.getTime() < thirtyDays) {
				diagnostics.push({
					severity: DiagnosticSeverity.Information,
					range: lineRange(lines, lineIndex, variable.name),
					message: `Secret expires on ${metadata.expires} — consider rotating soon`,
					source: "vars-expires",
				});
			}
		}
	}
}

/**
 * Create a range for a specific token on a given line.
 * If the token is found on the line, highlights just that token.
 * Otherwise, highlights the entire line.
 */
function lineRange(lines: string[], lineIndex: number, token?: string): Range {
	const line = lines[lineIndex] ?? "";

	if (token) {
		const col = line.indexOf(token);
		if (col >= 0) {
			return Range.create(lineIndex, col, lineIndex, col + token.length);
		}
	}

	return Range.create(lineIndex, 0, lineIndex, line.length);
}
