import { type CompletionItem, CompletionItemKind } from "vscode-languageserver/node.js";
import { getAllVariables, parseDocument } from "./patterns.js";
import { evaluateSchema, getZodMethodsForType } from "./zod-introspect.js";

export interface CompletionContext {
	text: string;
	line: number;
	character: number;
	uri: string;
}

/** Top-level z.* factory methods */
const ZOD_FACTORIES = [
	"string",
	"number",
	"boolean",
	"date",
	"bigint",
	"enum",
	"nativeEnum",
	"coerce",
	"literal",
	"union",
	"optional",
	"nullable",
	"array",
	"object",
	"tuple",
	"record",
	"any",
	"unknown",
	"never",
	"void",
	"undefined",
	"null",
];

/**
 * Compute completions for a given cursor position in a .vars document.
 */
export function computeCompletions(ctx: CompletionContext): CompletionItem[] {
	const lines = ctx.text.split("\n");
	const currentLine = lines[ctx.line] ?? "";
	const prefix = currentLine.slice(0, ctx.character);

	// After "z." — Zod method completions
	const zodContext = getZodContext(prefix);
	if (zodContext) {
		if (zodContext.isTopLevel) {
			return ZOD_FACTORIES.map((name) => ({
				label: name,
				kind: CompletionItemKind.Function,
				detail: `z.${name}()`,
			}));
		}
		if (zodContext.isCoerce) {
			return ["string", "number", "boolean", "date", "bigint"].map((name) => ({
				label: name,
				kind: CompletionItemKind.Function,
				detail: `z.coerce.${name}()`,
			}));
		}
		if (zodContext.schemaPrefix) {
			return getZodMethodCompletions(zodContext.schemaPrefix);
		}
	}

	// Inside metadata parens — metadata keys
	if (isInsideMetadata(ctx.text, ctx.line)) {
		return getMetadataCompletions();
	}

	// Inside check block — check language keywords + variable names
	if (isInsideCheck(ctx.text, ctx.line)) {
		const result = parseDocument(ctx.text);
		const vars = getAllVariables(result.ast);
		return [
			...vars.map((v) => ({ label: v.name, kind: CompletionItemKind.Variable })),
			{ label: "env", kind: CompletionItemKind.Variable, detail: "Current environment" },
			{
				label: "defined",
				kind: CompletionItemKind.Function,
				insertText: "defined($1)",
				insertTextFormat: 2 as const,
			},
			{
				label: "matches",
				kind: CompletionItemKind.Function,
				insertText: 'matches($1, "$2")',
				insertTextFormat: 2 as const,
			},
			{
				label: "starts_with",
				kind: CompletionItemKind.Function,
				insertText: 'starts_with($1, "$2")',
				insertTextFormat: 2 as const,
			},
			{
				label: "one_of",
				kind: CompletionItemKind.Function,
				insertText: "one_of($1, [$2])",
				insertTextFormat: 2 as const,
			},
			{
				label: "length",
				kind: CompletionItemKind.Function,
				insertText: "length($1)",
				insertTextFormat: 2 as const,
			},
			{ label: "and", kind: CompletionItemKind.Keyword },
			{ label: "or", kind: CompletionItemKind.Keyword },
			{ label: "not", kind: CompletionItemKind.Keyword },
		];
	}

	// At line start — top-level keywords
	if (prefix.match(/^\s*$/)) {
		return [
			{
				label: "env",
				kind: CompletionItemKind.Keyword,
				insertText: "env($1)",
				insertTextFormat: 2 as const,
				detail: "Declare environments",
			},
			{
				label: "param",
				kind: CompletionItemKind.Keyword,
				insertText: "param $1 : enum($2) = $3",
				insertTextFormat: 2 as const,
			},
			{
				label: "use",
				kind: CompletionItemKind.Keyword,
				insertText: 'use "$1"',
				insertTextFormat: 2 as const,
			},
			{
				label: "group",
				kind: CompletionItemKind.Keyword,
				insertText: "group $1 {\n  $2\n}",
				insertTextFormat: 2 as const,
			},
			{ label: "public", kind: CompletionItemKind.Keyword },
			{
				label: "check",
				kind: CompletionItemKind.Keyword,
				insertText: 'check "$1" {\n  $2\n}',
				insertTextFormat: 2 as const,
			},
		];
	}

	// Inside env block — env names
	if (isInsideEnvBlock(ctx.text, ctx.line)) {
		const result = parseDocument(ctx.text);
		return result.ast.envs.map((e) => ({ label: e, kind: CompletionItemKind.Value }));
	}

	return [];
}

function getMetadataCompletions(): CompletionItem[] {
	return [
		{
			label: "description",
			kind: CompletionItemKind.Property,
			insertText: 'description = "$1"',
			insertTextFormat: 2 as const,
		},
		{
			label: "owner",
			kind: CompletionItemKind.Property,
			insertText: 'owner = "$1"',
			insertTextFormat: 2 as const,
		},
		{
			label: "expires",
			kind: CompletionItemKind.Property,
			insertText: "expires = $1",
			insertTextFormat: 2 as const,
		},
		{
			label: "deprecated",
			kind: CompletionItemKind.Property,
			insertText: 'deprecated = "$1"',
			insertTextFormat: 2 as const,
		},
		{
			label: "tags",
			kind: CompletionItemKind.Property,
			insertText: "tags = [$1]",
			insertTextFormat: 2 as const,
		},
	];
}

/**
 * Extract Zod completion context from the text before cursor.
 */
function getZodContext(
	prefix: string,
): { isTopLevel: boolean; isCoerce: boolean; schemaPrefix: string | null } | null {
	const zodMatch = prefix.match(/(z\..*)$/);
	if (!zodMatch) return null;
	return analyzeZodPrefix(zodMatch[1]);
}

function analyzeZodPrefix(
	zodText: string,
): { isTopLevel: boolean; isCoerce: boolean; schemaPrefix: string | null } | null {
	if (zodText === "z.") {
		return { isTopLevel: true, isCoerce: false, schemaPrefix: null };
	}
	if (zodText === "z.coerce.") {
		return { isTopLevel: false, isCoerce: true, schemaPrefix: null };
	}
	if (zodText.endsWith(".")) {
		const schemaPrefix = zodText.slice(0, -1);
		return { isTopLevel: false, isCoerce: false, schemaPrefix };
	}
	return null;
}

/**
 * Get Zod method completions by evaluating the schema prefix and introspecting.
 */
function getZodMethodCompletions(schemaPrefix: string): CompletionItem[] {
	const result = evaluateSchema(schemaPrefix);
	if (!result.success) return [];

	const methods = getZodMethodsForType(result.schema);
	return methods.map((name) => ({
		label: name,
		kind: CompletionItemKind.Method,
		detail: `${schemaPrefix}.${name}()`,
	}));
}

// Simple heuristics for context detection

function isInsideMetadata(text: string, line: number): boolean {
	const lines = text.split("\n");
	let parenDepth = 0;
	for (let i = line; i >= 0; i--) {
		const l = lines[i] ?? "";
		for (let j = l.length - 1; j >= 0; j--) {
			if (l[j] === ")") parenDepth++;
			if (l[j] === "(") {
				parenDepth--;
				if (parenDepth < 0) {
					// Check if this paren belongs to env() or enum() — not metadata
					const before = l.slice(0, j).trimEnd();
					if (before.endsWith("env") || before.endsWith("enum")) return false;
					return true;
				}
			}
		}
	}
	return false;
}

function isInsideCheck(text: string, line: number): boolean {
	const lines = text.split("\n");
	let braceDepth = 0;
	for (let i = line; i >= 0; i--) {
		const l = lines[i] ?? "";
		for (let j = l.length - 1; j >= 0; j--) {
			if (l[j] === "}") braceDepth++;
			if (l[j] === "{") braceDepth--;
		}
		// If we've exited all braces and find check keyword, we're inside
		if (braceDepth < 0 && l.match(/^check\s+"/)) return true;
		// If we've exited all braces and find a top-level construct, we're not inside
		if (braceDepth >= 0 && i < line && l.match(/^[a-zA-Z]/)) return false;
	}
	return false;
}

function isInsideEnvBlock(text: string, line: number): boolean {
	const lines = text.split("\n");
	let braceDepth = 0;
	for (let i = line; i >= 0; i--) {
		const l = lines[i] ?? "";
		for (let j = l.length - 1; j >= 0; j--) {
			if (l[j] === "}") braceDepth++;
			if (l[j] === "{") {
				braceDepth--;
				if (braceDepth < 0) return true;
			}
		}
	}
	return false;
}
