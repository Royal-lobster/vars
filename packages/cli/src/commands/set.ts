import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@dotvars/core";
import type { Declaration, VariableDecl } from "@dotvars/core";
import { isLocalPath, isUnlockedPath } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import { findVarsFile } from "../utils/context.js";
import {
	findDeclarationEndLine,
	serializeParsedVarsValue,
	serializeVarsValue,
	trailingMetadata,
} from "../utils/vars-edit.js";

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
		result = [`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)}`];

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
			existingEntries.set(env, `${env} = ${serializeVarsValue(val)}`);
		}

		// Rebuild the block
		result = [];
		const defaultVal = envUpdates.default;
		if (defaultVal) {
			result.push(`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(defaultVal)} {`);
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
			result.push(`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(defaultVal)} {`);
		} else if (value?.kind === "literal") {
			result.push(
				`${prefix}${variable.name}${schemaStr} = ${serializeParsedVarsValue(value.value)} {`,
			);
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}

		for (const [env, val] of Object.entries(envUpdates)) {
			if (env === "default") continue;
			result.push(`  ${env} = ${serializeVarsValue(val)}`);
		}
		result.push("}");

		// Case 4: Simple flat value update
	} else {
		result = [`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)}`];
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
		if (!isUnlockedPath(file) && !isLocalPath(file)) {
			console.error(
				pc.red("Refusing to write plaintext to a locked .vars file. Run `vars show` first."),
			);
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
		const endIdx = findDeclarationEndLine(content, startIdx);

		// Build replacement lines, preserving metadata if present
		const updatedLines = buildUpdatedBlock(variable, envUpdates, envs, lines, indent);

		// Check if there's trailing metadata we need to preserve
		if (variable.metadata) {
			const original = lines.slice(startIdx, endIdx + 1).join("\n");
			const metadata = trailingMetadata(original);
			if (metadata) updatedLines.push(`${indent}${metadata}`);
		}

		// Replace lines
		lines.splice(startIdx, endIdx - startIdx + 1, ...updatedLines);

		atomicWriteFileSync(file, lines.join("\n"));
		console.log(pc.green(`  ✓ Updated ${name} in ${file}`));
	},
});
