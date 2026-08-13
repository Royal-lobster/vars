import { readFileSync } from "node:fs";
import { type Declaration, type VariableDecl, normalizeSchema, parse } from "@dotvars/core";
import { encryptVarsContent, isLocalPath, isUnlockedPath } from "@dotvars/node";
import { detectGeneratedPlatform, generateForFileOrThrow } from "../commands/gen.js";
import { atomicWriteFileSync } from "./atomic-write.js";
import type { KeyCredentials } from "./context.js";
import { requireKey, resolveKeyFile } from "./context.js";
import {
	appendTrailingMetadata,
	findDeclarationEndLine,
	serializeParsedVarsValue,
	serializeVarsStringOrArray,
	serializeVarsValue,
	trailingMetadata,
} from "./vars-edit.js";

export interface VariableTarget {
	group: string | null;
	name: string;
}

export type VarsMutation =
	| {
			kind: "add";
			target: string;
			public: boolean;
			schema: string;
			values: Record<string, string>;
	  }
	| { kind: "set"; target: string; values: Record<string, string> }
	| { kind: "remove"; target: string }
	| { kind: "apply"; patch: string };

export interface MutationCredentials extends KeyCredentials {
	keyFile?: string;
}

export interface MutationResult {
	targets: string[];
	encrypted: boolean;
}

interface VariableMatch {
	variable: VariableDecl;
	group: string | null;
}

export async function mutateVarsFile(
	file: string,
	mutation: VarsMutation,
	credentials: MutationCredentials = {},
): Promise<MutationResult> {
	const original = readFileSync(file, "utf8");
	let updated: string;
	let targets: string[];

	switch (mutation.kind) {
		case "add":
			updated = addVariable(original, file, mutation);
			targets = [mutation.target];
			break;
		case "set":
			updated = setVariable(original, file, mutation.target, mutation.values);
			targets = [mutation.target];
			break;
		case "remove":
			updated = removeVariable(original, file, mutation.target);
			targets = [mutation.target];
			break;
		case "apply": {
			const applied = applyPatch(original, file, mutation.patch);
			updated = applied.content;
			targets = applied.targets;
			break;
		}
	}

	const locked = !isUnlockedPath(file) && !isLocalPath(file);
	const needsEncryption = locked && hasPlaintextSecrets(updated, file);
	if (needsEncryption) {
		const keyFile = resolveKeyFile(file, credentials.keyFile);
		const { key, scope } = await requireKey(keyFile, `vars ${mutation.kind}`, credentials);
		updated = await encryptVarsContent(updated, key, scope, file);
		if (hasPlaintextSecrets(updated, file)) {
			throw new Error(
				"The supplied PIN scope cannot encrypt every changed secret; no changes were written.",
			);
		}
	} else {
		const result = parse(updated, file);
		if (result.errors.length > 0) {
			throw new Error(`Cannot write invalid vars file: ${result.errors[0]!.message}`);
		}
	}

	atomicWriteFileSync(file, updated.endsWith("\n") ? updated : `${updated}\n`);
	if (locked) {
		const platform = detectGeneratedPlatform(file);
		if (platform) generateForFileOrThrow(file, platform);
	}
	return { targets, encrypted: needsEncryption };
}

export function parseVariableTarget(input: string): VariableTarget {
	const parts = input.split(".");
	if (parts.length > 2 || parts.some((part) => part.length === 0)) {
		throw new Error("Variable target must be NAME or group.NAME");
	}
	const [first, second] = parts;
	const group = second ? first! : null;
	const name = second ?? first!;
	if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
		throw new Error("Variable name must be UPPER_SNAKE_CASE");
	}
	if (group && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(group)) {
		throw new Error("Group name may contain letters, digits, hyphens, and underscores");
	}
	return { group, name };
}

export function readValueFile(path: string): string {
	const value = readFileSync(path, "utf8");
	return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function addVariable(
	content: string,
	file: string,
	mutation: Extract<VarsMutation, { kind: "add" }>,
): string {
	const target = parseVariableTarget(mutation.target);
	const parsed = parseOrThrow(content, file);
	if (findVariable(parsed.ast.declarations, target)) {
		throw new Error(`Variable "${mutation.target}" already exists`);
	}
	normalizeSchema(mutation.schema);
	const block = buildVariableBlock(target.name, mutation.public, mutation.schema, mutation.values);
	const lines = content.trimEnd().split("\n");

	if (!target.group) return `${lines.join("\n")}\n\n${block.join("\n")}\n`;

	const group = parsed.ast.declarations.find(
		(declaration) => declaration.kind === "group" && declaration.name === target.group,
	);
	if (!group || group.kind !== "group") {
		const indented = block.map((line) => `  ${line}`);
		return `${lines.join("\n")}\n\ngroup ${target.group} {\n${indented.join("\n")}\n}\n`;
	}

	const groupEnd = findDeclarationEndLine(content, group.line - 1);
	const indented = block.map((line) => `  ${line}`);
	lines.splice(groupEnd, 0, "", ...indented);
	return `${lines.join("\n")}\n`;
}

function setVariable(
	content: string,
	file: string,
	targetInput: string,
	values: Record<string, string>,
): string {
	if (Object.keys(values).length === 0) throw new Error("Provide at least one value to update");
	const target = parseVariableTarget(targetInput);
	const parsed = parseOrThrow(content, file);
	const match = findVariable(parsed.ast.declarations, target);
	if (!match) throw new Error(`Variable "${targetInput}" not found`);

	const lines = content.split("\n");
	const start = match.variable.line - 1;
	const end = findDeclarationEndLine(content, start);
	const originalBlock = lines.slice(start, end + 1).join("\n");
	const metadata = trailingMetadata(originalBlock);
	const replacement = buildUpdatedBlock(
		match.variable,
		values,
		parsed.ast.envs.length > 0 ? parsed.ast.envs : ["default"],
		lines,
		match.group ? "  " : "",
	);
	if (metadata) appendTrailingMetadata(replacement, metadata);
	lines.splice(start, end - start + 1, ...replacement);
	return lines.join("\n");
}

function removeVariable(content: string, file: string, targetInput: string): string {
	const target = parseVariableTarget(targetInput);
	const parsed = parseOrThrow(content, file);
	const match = findVariable(parsed.ast.declarations, target);
	if (!match) throw new Error(`Variable "${targetInput}" not found`);
	const lines = content.split("\n");
	const start = match.variable.line - 1;
	const end = findDeclarationEndLine(content, start);
	lines.splice(start, end - start + 1);
	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function applyPatch(
	content: string,
	file: string,
	patch: string,
): { content: string; targets: string[] } {
	const parsedPatch = parseOrThrow(patch, "<stdin>");
	if (
		parsedPatch.ast.imports.length > 0 ||
		parsedPatch.ast.params.length > 0 ||
		parsedPatch.ast.checks.length > 0
	) {
		throw new Error("vars apply accepts variable and group declarations only");
	}

	let updated = content;
	const targets: string[] = [];
	for (const declaration of parsedPatch.ast.declarations) {
		if (declaration.kind === "variable") {
			const target = declaration.name;
			updated = upsertRawDeclaration(updated, file, target, extractDeclaration(patch, declaration));
			targets.push(target);
			continue;
		}
		for (const variable of declaration.declarations) {
			const target = `${declaration.name}.${variable.name}`;
			updated = upsertRawDeclaration(
				updated,
				file,
				target,
				extractDeclaration(patch, variable).replace(/^\s+/, ""),
			);
			targets.push(target);
		}
	}
	if (targets.length === 0) throw new Error("vars apply received no variable declarations");
	return { content: updated, targets };
}

function upsertRawDeclaration(
	content: string,
	file: string,
	targetInput: string,
	raw: string,
): string {
	const target = parseVariableTarget(targetInput);
	const parsed = parseOrThrow(content, file);
	const match = findVariable(parsed.ast.declarations, target);
	if (!match) {
		const rawParsed = parseOrThrow(
			target.group ? `group ${target.group} {\n  ${raw.replace(/\n/g, "\n  ")}\n}` : raw,
			"<patch>",
		);
		const variable = target.group
			? rawParsed.ast.declarations[0]?.kind === "group"
				? rawParsed.ast.declarations[0].declarations[0]
				: undefined
			: rawParsed.ast.declarations[0]?.kind === "variable"
				? rawParsed.ast.declarations[0]
				: undefined;
		if (!variable) throw new Error(`Invalid declaration for ${targetInput}`);
		return addVariable(content, file, {
			kind: "add",
			target: targetInput,
			public: variable.public,
			schema: variable.schema ?? "z.string()",
			values: valuesFromVariable(variable),
		});
	}

	const lines = content.split("\n");
	const start = match.variable.line - 1;
	const end = findDeclarationEndLine(content, start);
	const indent = match.group ? "  " : "";
	lines.splice(start, end - start + 1, ...raw.split("\n").map((line) => `${indent}${line}`));
	return lines.join("\n");
}

function extractDeclaration(source: string, variable: VariableDecl): string {
	const lines = source.split("\n");
	const start = variable.line - 1;
	return lines.slice(start, findDeclarationEndLine(source, start) + 1).join("\n");
}

function valuesFromVariable(variable: VariableDecl): Record<string, string> {
	if (!variable.value) return {};
	if (variable.value.kind === "env_block") {
		return Object.fromEntries(
			variable.value.entries.map((entry) => [
				entry.env === "*" ? "default" : entry.env,
				valueAsString(entry.value),
			]),
		);
	}
	return { default: valueAsString(variable.value) };
}

function valueAsString(value: NonNullable<VariableDecl["value"]>): string {
	if (value.kind === "encrypted") return value.raw;
	if (value.kind === "literal") {
		return Array.isArray(value.value) ? JSON.stringify(value.value) : String(value.value);
	}
	if (value.kind === "interpolated") return value.template;
	throw new Error("vars apply does not yet support conditional values");
}

function findVariable(declarations: Declaration[], target: VariableTarget): VariableMatch | null {
	if (target.group) {
		const group = declarations.find(
			(declaration) => declaration.kind === "group" && declaration.name === target.group,
		);
		if (!group || group.kind !== "group") return null;
		const variable = group.declarations.find((item) => item.name === target.name);
		return variable ? { variable, group: group.name } : null;
	}
	const topLevel = declarations.find(
		(declaration): declaration is VariableDecl =>
			declaration.kind === "variable" && declaration.name === target.name,
	);
	if (topLevel) return { variable: topLevel, group: null };
	const grouped = declarations.flatMap((declaration) =>
		declaration.kind === "group"
			? declaration.declarations
					.filter((variable) => variable.name === target.name)
					.map((variable) => ({ variable, group: declaration.name }))
			: [],
	);
	if (grouped.length > 1) throw new Error(`Variable "${target.name}" is ambiguous; use group.NAME`);
	return grouped[0] ?? null;
}

function parseOrThrow(content: string, file: string) {
	const result = parse(content, file);
	if (result.errors.length > 0) throw new Error(result.errors[0]!.message);
	return result;
}

function buildVariableBlock(
	name: string,
	isPublic: boolean,
	schema: string,
	values: Record<string, string>,
): string[] {
	const lines: string[] = [];
	const prefix = isPublic ? "public " : "";
	const schemaStr = schema !== "z.string()" ? ` : ${schema}` : "";
	if (Object.keys(values).length === 0) {
		lines.push(`${prefix}${name}${schemaStr}`);
	} else if (Object.keys(values).length === 1 && values.default !== undefined) {
		lines.push(`${prefix}${name}${schemaStr} = ${serializeVarsStringOrArray(values.default)}`);
	} else {
		lines.push(`${prefix}${name}${schemaStr} {`);
		for (const [env, value] of Object.entries(values)) {
			lines.push(`  ${env} = ${serializeVarsStringOrArray(value)}`);
		}
		lines.push("}");
	}
	return lines;
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

	if (
		envUpdates.default !== undefined &&
		Object.keys(envUpdates).length === 1 &&
		envs.length <= 1
	) {
		result = [`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)}`];
	} else if (value?.kind === "env_block") {
		const existingEntries = new Map<string, string>();
		const defaultEntry = value.entries.find((entry) => entry.env === "*");
		for (const entry of value.entries) {
			if (entry.env === "*") continue;
			existingEntries.set(entry.env, lines[entry.line - 1]!.trim());
		}
		for (const [env, updatedValue] of Object.entries(envUpdates)) {
			if (env !== "default")
				existingEntries.set(env, `${env} = ${serializeVarsValue(updatedValue)}`);
		}
		result = [];
		if (envUpdates.default !== undefined) {
			result.push(
				`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)} {`,
			);
		} else if (defaultEntry) {
			const declarationLine = lines[variable.line - 1]!;
			const match = declarationLine.match(/=\s*.+?(?=\s*\{)/);
			result.push(
				match
					? `${prefix}${variable.name}${schemaStr} = ${match[0].replace(/^=\s*/, "").trim()} {`
					: `${prefix}${variable.name}${schemaStr} {`,
			);
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}
		for (const line of existingEntries.values()) result.push(`  ${line}`);
		result.push("}");
	} else if (Object.keys(envUpdates).some((key) => key !== "default")) {
		result = [];
		if (envUpdates.default !== undefined) {
			result.push(
				`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)} {`,
			);
		} else if (value?.kind === "literal") {
			result.push(
				`${prefix}${variable.name}${schemaStr} = ${serializeParsedVarsValue(value.value)} {`,
			);
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}
		for (const [env, updatedValue] of Object.entries(envUpdates)) {
			if (env !== "default") result.push(`  ${env} = ${serializeVarsValue(updatedValue)}`);
		}
		result.push("}");
	} else {
		result = [`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default!)}`];
	}
	return result.map((line) => indent + line);
}

function hasPlaintextSecrets(content: string, file: string): boolean {
	const parsed = parseOrThrow(content, file);
	for (const declaration of parsed.ast.declarations) {
		const variables = declaration.kind === "group" ? declaration.declarations : [declaration];
		for (const variable of variables) {
			if (!variable.public && valueContainsPlaintext(variable.value)) return true;
		}
	}
	return false;
}

function valueContainsPlaintext(value: VariableDecl["value"]): boolean {
	if (!value || value.kind === "encrypted") return false;
	if (value.kind === "env_block") {
		return value.entries.some((entry) => valueContainsPlaintext(entry.value));
	}
	if (value.kind === "conditional") {
		return true;
	}
	return true;
}
