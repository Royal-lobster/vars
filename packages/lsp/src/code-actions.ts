import { VAR_DECL_RE } from "./patterns.js";

export interface CodeActionContext {
	text: string;
	startLine: number;
	endLine: number;
	uri: string;
}

export interface CodeAction {
	title: string;
	kind: string;
	edit: TextEdit[];
}

export interface TextEdit {
	line: number;
	character: number;
	newText: string;
}

/**
 * Compute code actions for a selection range in a .vars document.
 */
export function computeCodeActions(ctx: CodeActionContext): CodeAction[] {
	const actions: CodeAction[] = [];
	const lines = ctx.text.split("\n");

	// Find the variable declaration in the selected range
	const variable = findVariableInRange(lines, ctx.startLine, ctx.endLine);
	if (!variable) return actions;

	// Collect all environment names used across the entire file
	const fileEnvs = collectAllEnvNames(lines);

	// Collect environments for this specific variable
	const varEnvs = collectVarEnvNames(lines, variable.lineIndex);

	// Code action: Add missing environments
	const missingEnvs = fileEnvs.filter((env) => !varEnvs.has(env));
	if (missingEnvs.length > 0) {
		const insertLine = findLastEnvLine(lines, variable.lineIndex) + 1;
		const edits = missingEnvs.map((env) => ({
			line: insertLine,
			character: 0,
			newText: `  @${env.padEnd(8)} = \n`,
		}));
		actions.push({
			title: `Add missing environment${missingEnvs.length > 1 ? "s" : ""}: ${missingEnvs.map((e) => `@${e}`).join(", ")}`,
			kind: "quickfix.add-envs",
			edit: edits,
		});
	}

	// Code action: Mark as deprecated
	const hasDeprecated = checkHasDirective(lines, variable.lineIndex, "@deprecated");
	if (!hasDeprecated) {
		const insertLine = variable.lineIndex + 1;
		actions.push({
			title: "Mark as deprecated",
			kind: "refactor.deprecated",
			edit: [
				{
					line: insertLine,
					character: 0,
					newText: '  @deprecated ""\n',
				},
			],
		});
	}

	return actions;
}

interface VariableInfo {
	name: string;
	lineIndex: number;
}

/**
 * Find the variable declaration within the given line range.
 */
function findVariableInRange(
	lines: string[],
	startLine: number,
	endLine: number,
): VariableInfo | null {
	// Walk up from startLine to find the variable declaration
	for (let i = startLine; i >= 0; i--) {
		const match = lines[i].match(VAR_DECL_RE);
		if (match) {
			return { name: match[1], lineIndex: i };
		}
		// If we hit another variable or a top-level directive, stop
		if (i < startLine && !lines[i].match(/^\s/)) break;
	}

	// Also check forward in the range
	for (let i = startLine; i <= endLine && i < lines.length; i++) {
		const match = lines[i].match(VAR_DECL_RE);
		if (match) {
			return { name: match[1], lineIndex: i };
		}
	}

	return null;
}

/**
 * Collect all unique environment names used across the entire file.
 */
function collectAllEnvNames(lines: string[]): string[] {
	const envs = new Set<string>();
	for (const line of lines) {
		const match = line.match(/^\s+@(\w+)\s*=/);
		if (match && match[1] !== "default") {
			envs.add(match[1]);
		}
	}
	return Array.from(envs).sort();
}

/**
 * Collect environment names for a specific variable (from its indented lines).
 */
function collectVarEnvNames(lines: string[], varLine: number): Set<string> {
	const envs = new Set<string>();
	for (let i = varLine + 1; i < lines.length; i++) {
		if (!lines[i] || !/^\s+/.test(lines[i])) break;
		const match = lines[i].match(/^\s+@(\w+)\s*=/);
		if (match) envs.add(match[1]);
	}
	return envs;
}

/**
 * Find the last indented line belonging to a variable.
 */
function findLastEnvLine(lines: string[], varLine: number): number {
	let last = varLine;
	for (let i = varLine + 1; i < lines.length; i++) {
		if (!lines[i] || !/^\s+/.test(lines[i])) break;
		last = i;
	}
	return last;
}

/**
 * Check if a variable has a specific directive.
 */
function checkHasDirective(lines: string[], varLine: number, directive: string): boolean {
	for (let i = varLine + 1; i < lines.length; i++) {
		if (!lines[i] || !/^\s+/.test(lines[i])) break;
		if (lines[i].trim().startsWith(directive)) return true;
	}
	return false;
}
