import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@dotvars/core";
import type { Declaration, VariableDecl } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile } from "../utils/context.js";

function findVariable(
	declarations: Declaration[],
	name: string,
): { variable: VariableDecl; group?: string } | null {
	for (const decl of declarations) {
		if (decl.kind === "variable" && decl.name === name) {
			return { variable: decl };
		}
		if (decl.kind === "group") {
			for (const v of decl.declarations) {
				if (v.name === name) return { variable: v, group: decl.name };
			}
		}
	}
	return null;
}

function findBlockEnd(lines: string[], startLine: number): number {
	let end = startLine;
	// If the declaration line has an opening brace, find matching close
	if (lines[startLine].includes("{")) {
		let depth = 0;
		for (let i = startLine; i < lines.length; i++) {
			for (const ch of lines[i]) {
				if (ch === "{") depth++;
				if (ch === "}") depth--;
			}
			if (depth <= 0) {
				end = i;
				break;
			}
		}
	}

	// Check for trailing metadata block: ( ... ), skipping blank lines
	let metaSearchIdx = end + 1;
	while (metaSearchIdx < lines.length && lines[metaSearchIdx].trim() === "") {
		metaSearchIdx++;
	}
	const nextNonEmpty = lines[metaSearchIdx]?.trim();
	if (nextNonEmpty?.startsWith("(")) {
		for (let i = metaSearchIdx; i < lines.length; i++) {
			if (lines[i].includes(")")) {
				end = i;
				break;
			}
		}
	}

	return end;
}

function quoteValue(val: string): string {
	// Don't double-quote if already quoted, or if it looks like a number/boolean
	if (val === "true" || val === "false") return val;
	if (/^\d+(\.\d+)?$/.test(val)) return val;
	if (val.startsWith("[") || val.startsWith("{")) return val;
	if (val.startsWith('"') && val.endsWith('"')) return val;
	return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildUpdatedBlock(
	variable: VariableDecl,
	envUpdates: Record<string, string>,
	envs: string[],
	lines: string[],
	indent: string,
): string[] {
	const prefix = variable.public ? "public " : "";
	const schemaStr = variable.schema ? ` : ${variable.schema}` : "";
	const value = variable.value;

	let result: string[];

	// Case 1: Setting a single value on a flat variable with no envs
	if (envUpdates.default && Object.keys(envUpdates).length === 1 && envs.length <= 1) {
		result = [`${prefix}${variable.name}${schemaStr} = ${quoteValue(envUpdates.default)}`];

		// Case 2: Variable currently has an env block — update specific entries
	} else if (value?.kind === "env_block") {
		const existingEntries = new Map<string, string>();
		const defaultEntry = value.entries.find((e) => e.env === "*");

		// Collect current values from source lines for entries we're NOT updating
		for (const entry of value.entries) {
			if (entry.env === "*") continue;
			const line = lines[entry.line - 1];
			existingEntries.set(entry.env, line.trim());
		}

		// Apply updates
		for (const [env, val] of Object.entries(envUpdates)) {
			if (env === "default") continue;
			existingEntries.set(env, `${env} = ${quoteValue(val)}`);
		}

		// Rebuild the block
		result = [];
		const defaultVal = envUpdates.default;
		if (defaultVal) {
			result.push(`${prefix}${variable.name}${schemaStr} = ${quoteValue(defaultVal)} {`);
		} else if (defaultEntry) {
			// Preserve existing default from source
			const declLine = lines[variable.line - 1];
			const eqMatch = declLine.match(/=\s*.+?(?=\s*\{)/);
			if (eqMatch) {
				result.push(
					`${prefix}${variable.name}${schemaStr} = ${eqMatch[0].replace(/^=\s*/, "").trim()} {`,
				);
			} else {
				result.push(`${prefix}${variable.name}${schemaStr} {`);
			}
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}

		for (const [, line] of existingEntries) {
			result.push(`  ${line}`);
		}
		result.push("}");

		// Case 3: Variable is flat but we're setting env-specific values — convert to env block
	} else if (Object.keys(envUpdates).some((k) => k !== "default")) {
		result = [];
		const defaultVal = envUpdates.default;

		// Preserve existing flat value as default if no new default given
		if (defaultVal) {
			result.push(`${prefix}${variable.name}${schemaStr} = ${quoteValue(defaultVal)} {`);
		} else if (value?.kind === "literal") {
			result.push(`${prefix}${variable.name}${schemaStr} = ${quoteValue(String(value.value))} {`);
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}

		for (const [env, val] of Object.entries(envUpdates)) {
			if (env === "default") continue;
			result.push(`  ${env} = ${quoteValue(val)}`);
		}
		result.push("}");

		// Case 4: Simple flat value update
	} else {
		result = [`${prefix}${variable.name}${schemaStr} = ${quoteValue(envUpdates.default)}`];
	}

	// Apply indentation (for variables inside groups)
	return result.map((line) => indent + line);
}

export default defineCommand({
	meta: { name: "set", description: "Update a variable's value in a .vars file" },
	args: {
		name: { type: "positional", required: true, description: "Variable name to update" },
		file: { type: "string", alias: "f" },
		value: {
			type: "string",
			alias: "v",
			description: "Value (applies to all envs, or use --dev/--prod)",
		},
		dev: { type: "string", description: "Value for dev environment" },
		staging: { type: "string", description: "Value for staging environment" },
		prod: { type: "string", description: "Value for prod environment" },
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file as string) : findVarsFile(process.cwd());
		if (!file) {
			console.error(pc.red("No .vars file found"));
			process.exit(1);
		}

		const name = args.name as string;
		if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
			console.error(pc.red("Variable name must be UPPER_SNAKE_CASE"));
			process.exit(1);
		}

		const content = readFileSync(file, "utf8");
		const result = parse(content, file);
		const envs = result.ast.envs.length > 0 ? result.ast.envs : ["default"];

		const match = findVariable(result.ast.declarations, name);
		if (!match) {
			console.error(
				pc.red(`Variable "${name}" not found. Use ${pc.bold("vars add")} to create it.`),
			);
			process.exit(1);
		}

		// Collect env values from flags
		const envUpdates: Record<string, string> = {};

		if (args.value) {
			envUpdates.default = args.value as string;
		}

		for (const env of envs) {
			if (args[env]) {
				envUpdates[env] = args[env] as string;
			}
		}

		if (Object.keys(envUpdates).length === 0) {
			console.error(pc.red("No values specified. Use --value, --dev, --prod, etc."));
			process.exit(1);
		}

		const lines = content.split("\n");
		const { variable, group } = match;

		// Detect indentation from the original declaration line
		const indent = group ? (lines[variable.line - 1].match(/^(\s*)/)?.[1] ?? "") : "";

		// Find the range of lines to replace (declaration line through end of block/metadata)
		const startIdx = variable.line - 1;
		const endIdx = findBlockEnd(lines, startIdx);

		// Build replacement lines, preserving metadata if present
		const updatedLines = buildUpdatedBlock(variable, envUpdates, envs, lines, indent);

		// Check if there's trailing metadata we need to preserve
		if (variable.metadata) {
			const metaLines: string[] = [];
			for (let i = startIdx; i <= endIdx; i++) {
				const trimmed = lines[i].trim();
				if (trimmed.startsWith("(") || (metaLines.length > 0 && !trimmed.startsWith(")"))) {
					metaLines.push(lines[i]);
				}
				if (metaLines.length > 0 && trimmed.endsWith(")")) {
					metaLines.push(lines[i]);
					break;
				}
			}
			if (metaLines.length > 0) {
				updatedLines.push(...metaLines);
			}
		}

		// Replace lines
		lines.splice(startIdx, endIdx - startIdx + 1, ...updatedLines);

		writeFileSync(file, lines.join("\n"));
		console.log(pc.green(`  ✓ Updated ${name} in ${file}`));
	},
});
