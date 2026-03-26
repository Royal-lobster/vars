import { parse } from "@dotvars/core";
import type { ParseResult, VariableDecl, VarsFile } from "@dotvars/core";

export function parseDocument(text: string, uri?: string): ParseResult {
	return parse(text, uri);
}

export function findVariableAtLine(ast: VarsFile, line: number): VariableDecl | null {
	for (const decl of ast.declarations) {
		if (decl.kind === "variable" && decl.line === line) return decl;
		if (decl.kind === "group") {
			for (const v of decl.declarations) {
				if (v.line === line) return v;
			}
		}
	}
	return null;
}

export function getAllVariables(ast: VarsFile): VariableDecl[] {
	const vars: VariableDecl[] = [];
	for (const decl of ast.declarations) {
		if (decl.kind === "variable") vars.push(decl);
		if (decl.kind === "group") vars.push(...decl.declarations);
	}
	return vars;
}
