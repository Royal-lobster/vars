import { evaluateSchema, getSchemaInfo } from "./zod-introspect.js";

export interface HoverContext {
	text: string;
	line: number;
	character: number;
	uri: string;
}

export interface HoverResult {
	contents: string;
	range?: { startLine: number; startChar: number; endLine: number; endChar: number };
}

/**
 * Compute hover information for a position in a .vars document.
 * Returns null if there's nothing meaningful to show at that position.
 */
export function computeHover(ctx: HoverContext): HoverResult | null {
	const lines = ctx.text.split("\n");
	const currentLine = lines[ctx.line] ?? "";

	// Skip comment lines
	if (currentLine.trimStart().startsWith("#")) {
		return null;
	}

	// Skip indented lines (env values, metadata) — only hover on variable declarations
	if (/^\s+/.test(currentLine)) {
		return null;
	}

	// Skip empty lines
	if (currentLine.trim() === "") {
		return null;
	}

	// Skip @refine and @extends top-level directives
	if (currentLine.trimStart().startsWith("@")) {
		return null;
	}

	// Parse the variable declaration from this line
	const varMatch = currentLine.match(/^([A-Z_][A-Z0-9_]*)\s{2,}(z\..+)$/);
	if (!varMatch) return null;

	const varName = varMatch[1];
	const schemaText = varMatch[2];

	// Collect metadata from subsequent indented lines
	const metadata = collectMetadata(lines, ctx.line);

	// Evaluate the schema and extract type info
	const evalResult = evaluateSchema(schemaText);
	let typeInfo = "";

	if (evalResult.success) {
		const info = getSchemaInfo(evalResult.schema);
		typeInfo = formatTypeInfo(info);
	} else {
		typeInfo = `**Type:** Error evaluating schema — ${evalResult.error}`;
	}

	// Determine hover range based on cursor position
	const schemaStart = currentLine.indexOf(schemaText);
	const onSchema = ctx.character >= schemaStart && schemaStart >= 0;

	// Build hover contents
	const parts: string[] = [];

	if (onSchema) {
		// Hovering on the schema portion — show schema expression + type details
		parts.push(`\`\`\`\n${schemaText}\n\`\`\``);
		parts.push("");
		parts.push(typeInfo);
	} else {
		// Hovering on the variable name — show full variable info
		parts.push(`**\`${varName}\`**`);
		parts.push("");
		parts.push(typeInfo);

		if (metadata.description) {
			parts.push("");
			parts.push(`**Description:** ${metadata.description}`);
		}

		if (metadata.deprecated) {
			parts.push("");
			parts.push(`**Deprecated:** ${metadata.deprecated}`);
		}

		if (metadata.expires) {
			parts.push("");
			parts.push(`**Expires:** ${metadata.expires}`);
		}

		if (metadata.owner) {
			parts.push("");
			parts.push(`**Owner:** ${metadata.owner}`);
		}
	}

	const range = onSchema
		? { startLine: ctx.line, startChar: schemaStart, endLine: ctx.line, endChar: schemaStart + schemaText.length }
		: { startLine: ctx.line, startChar: 0, endLine: ctx.line, endChar: varName.length };

	return {
		contents: parts.join("\n"),
		range,
	};
}

interface MetadataInfo {
	description?: string;
	deprecated?: string;
	expires?: string;
	owner?: string;
}

/**
 * Collect metadata directives from indented lines below a variable declaration.
 */
function collectMetadata(lines: string[], varLine: number): MetadataInfo {
	const meta: MetadataInfo = {};

	for (let i = varLine + 1; i < lines.length; i++) {
		const line = lines[i];
		// Stop at non-indented lines (next variable, comment, @refine, blank with next var)
		if (!line || !/^\s+/.test(line)) break;

		const trimmed = line.trim();

		const descMatch = trimmed.match(/^@description\s+"(.+)"$/);
		if (descMatch) meta.description = descMatch[1];

		const deprecatedMatch = trimmed.match(/^@deprecated\s+"(.+)"$/);
		if (deprecatedMatch) meta.deprecated = deprecatedMatch[1];

		const expiresMatch = trimmed.match(/^@expires\s+(\S+)$/);
		if (expiresMatch) meta.expires = expiresMatch[1];

		const ownerMatch = trimmed.match(/^@owner\s+(\S+)$/);
		if (ownerMatch) meta.owner = ownerMatch[1];
	}

	return meta;
}

/**
 * Format schema info into a readable hover string.
 */
function formatTypeInfo(info: ReturnType<typeof getSchemaInfo>): string {
	const parts: string[] = [];

	let typeStr = `**Type:** ${info.typeName}`;
	if (info.isCoerced) typeStr += " (coerced)";
	if (info.isOptional) typeStr += " (optional)";
	if (info.hasDefault) typeStr += " (has default)";
	parts.push(typeStr);

	if (info.enumValues && info.enumValues.length > 0) {
		parts.push(`**Values:** ${info.enumValues.map((v) => `\`"${v}"\``).join(" | ")}`);
	}

	if (info.checks.length > 0) {
		const checkStrs = info.checks.map((c) => {
			if (c.value !== undefined) return `${c.kind}: ${c.value}`;
			return c.kind;
		});
		parts.push(`**Checks:** ${checkStrs.join(", ")}`);
	}

	return parts.join("\n");
}
