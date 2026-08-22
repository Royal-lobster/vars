import { existsSync, readFileSync, rmSync } from "node:fs";
import { type Declaration, type VariableDecl, normalizeSchema, parse } from "@dotvars/core";
import {
	type KeyScope,
	encryptVarsContent,
	isLocalPath,
	isUnlockedPath,
	toCanonicalPath,
	toUnlockedPath,
} from "@dotvars/node";
import { atomicWriteFileSync } from "./atomic-write.js";
import { detectGeneratedPlatform, generateForFileOrThrow } from "./generated-output.js";
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

export interface MutationOptions {
	getKey?: () => Promise<{ key: Buffer; scope: KeyScope }>;
}

export interface MutationResult {
	targets: string[];
	encrypted: boolean;
}

interface VariableMatch {
	variable: VariableDecl;
	group: string | null;
}

export function mutateVarsSource(
	content: string,
	file: string,
	mutation: VarsMutation,
): MutationResult & { content: string } {
	const targets = mutationTargets(mutation);
	const duplicates = targets.filter((target, index) => targets.indexOf(target) !== index);
	if (duplicates.length > 0) {
		throw new Error(`Duplicate declaration in vars apply input: ${duplicates[0]}`);
	}
	switch (mutation.kind) {
		case "add":
			return {
				content: addVariable(content, file, mutation),
				targets: [mutation.target],
				encrypted: false,
			};
		case "set":
			return {
				content: setVariable(content, file, mutation.target, mutation.values),
				targets: [mutation.target],
				encrypted: false,
			};
		case "remove":
			return {
				content: removeVariable(content, file, mutation.target),
				targets: [mutation.target],
				encrypted: false,
			};
		case "apply": {
			const applied = applyPatch(content, file, mutation.patch);
			return { ...applied, encrypted: false };
		}
	}
}

export async function mutateVarsFile(
	file: string,
	mutation: VarsMutation,
	options: MutationOptions = {},
): Promise<MutationResult> {
	const unlocked = isUnlockedPath(file) ? file : toUnlockedPath(file);
	if (!isUnlockedPath(file) && !isLocalPath(file) && existsSync(unlocked)) {
		throw new Error(`Refusing locked mutation while ${unlocked} is open. Run vars hide first.`);
	}
	const original = readFileSync(file, "utf8");
	const transformed = mutateVarsSource(original, file, mutation);
	let updated = transformed.content;
	const targets = transformed.targets;

	const locked = !isUnlockedPath(file) && !isLocalPath(file);
	const originalPlaintext = locked
		? collectPlaintextSecrets(original, file)
		: new Map<string, string>();
	const changedPlaintextSecret =
		locked && hasNewPlaintextSecret(originalPlaintext, collectPlaintextSecrets(updated, file));
	if (changedPlaintextSecret) {
		if (!options.getKey) {
			throw new Error("This mutation introduces a secret value and requires an encryption key.");
		}
		const { key, scope } = await options.getKey();
		updated = await encryptVarsContent(updated, key, scope, file);
		if (hasNewPlaintextSecret(originalPlaintext, collectPlaintextSecrets(updated, file))) {
			const reason =
				scope === "master"
					? "The new secret could not be encrypted; only quoted string secrets are supported"
					: "The supplied owner PIN cannot encrypt every changed secret";
			throw new Error(`${reason}; no changes were written.`);
		}
	} else {
		const result = parse(updated, file);
		if (result.errors.length > 0) {
			throw new Error(`Cannot write invalid vars file: ${result.errors[0]!.message}`);
		}
	}

	const platform = locked ? detectGeneratedPlatform(file) : null;
	const generatedPath = toCanonicalPath(file).replace(/\.vars$/, ".generated.ts");
	const generatedOriginal =
		platform && existsSync(generatedPath) ? readFileSync(generatedPath, "utf8") : undefined;
	atomicWriteFileSync(file, updated.endsWith("\n") ? updated : `${updated}\n`);
	if (platform) {
		try {
			generateForFileOrThrow(file, platform);
		} catch (error) {
			atomicWriteFileSync(file, original);
			if (generatedOriginal === undefined) {
				if (existsSync(generatedPath)) rmSync(generatedPath);
			} else {
				atomicWriteFileSync(generatedPath, generatedOriginal);
			}
			throw error;
		}
	}
	return { targets, encrypted: changedPlaintextSecret };
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
function mutationTargets(mutation: VarsMutation): string[] {
	if (mutation.kind !== "apply") return [mutation.target];
	const parsed = parseOrThrow(mutation.patch, "<stdin>");
	return parsed.ast.declarations.flatMap((declaration) =>
		declaration.kind === "variable"
			? [declaration.name]
			: declaration.declarations.map((variable) => `${declaration.name}.${variable.name}`),
	);
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
		parsedPatch.ast.envs.length > 0 ||
		parsedPatch.ast.imports.length > 0 ||
		parsedPatch.ast.params.length > 0 ||
		parsedPatch.ast.checks.length > 0 ||
		parsedPatch.ast.declarations.some((declaration) => {
			const variables = declaration.kind === "group" ? declaration.declarations : [declaration];
			return variables.some((variable) => containsConditional(variable.value));
		})
	) {
		throw new Error(
			"vars apply accepts only variable and group declarations without conditional values",
		);
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
			updated = upsertRawDeclaration(updated, file, target, extractDeclaration(patch, variable));
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
	const match = findVariableExact(parsed.ast.declarations, target);
	const normalizedRaw = dedentDeclaration(raw);
	if (!match) return insertRawDeclaration(content, file, target, normalizedRaw);

	const lines = content.split("\n");
	const start = match.variable.line - 1;
	const end = findDeclarationEndLine(content, start);
	const indent = match.group ? "  " : "";
	const replacement = normalizedRaw.split("\n").map((line) => `${indent}${line}`);
	const existingMetadata = trailingMetadata(lines.slice(start, end + 1).join("\n"));
	if (!trailingMetadata(normalizedRaw) && existingMetadata) {
		appendTrailingMetadata(replacement, existingMetadata);
	}
	lines.splice(start, end - start + 1, ...replacement);
	return lines.join("\n");
}

function extractDeclaration(source: string, variable: VariableDecl): string {
	const lines = source.split("\n");
	const start = variable.line - 1;
	return dedentDeclaration(
		lines.slice(start, findDeclarationEndLine(source, start) + 1).join("\n"),
	);
}

function dedentDeclaration(raw: string): string {
	const lines = raw.split("\n");
	const indentation = lines
		.filter((line) => line.trim().length > 0)
		.map((line) => line.match(/^\s*/)?.[0].length ?? 0);
	const commonIndent = indentation.length > 0 ? Math.min(...indentation) : 0;
	return lines.map((line) => line.slice(Math.min(commonIndent, line.length))).join("\n");
}

function containsConditional(value: VariableDecl["value"]): boolean {
	if (!value) return false;
	if (value.kind === "conditional") return true;
	if (value.kind === "env_block") {
		return value.entries.some((entry) => containsConditional(entry.value));
	}
	return false;
}

function insertRawDeclaration(
	content: string,
	file: string,
	target: VariableTarget,
	raw: string,
): string {
	const parsed = parseOrThrow(content, file);
	const lines = content.trimEnd().split("\n");
	if (!target.group) return `${lines.join("\n")}\n\n${raw}\n`;

	const group = parsed.ast.declarations.find(
		(declaration) => declaration.kind === "group" && declaration.name === target.group,
	);
	const indented = raw.split("\n").map((line) => `  ${line}`);
	if (!group || group.kind !== "group") {
		return `${lines.join("\n")}\n\ngroup ${target.group} {\n${indented.join("\n")}\n}\n`;
	}
	const groupEnd = findDeclarationEndLine(content, group.line - 1);
	lines.splice(groupEnd, 0, "", ...indented);
	return `${lines.join("\n")}\n`;
}

function findVariableExact(
	declarations: Declaration[],
	target: VariableTarget,
): VariableMatch | null {
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
	return topLevel ? { variable: topLevel, group: null } : null;
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
		const existingEntries: string[][] = [];
		const defaultEntry = value.entries.find((entry) => entry.env === "*");
		const source = lines.join("\n");
		const seenLines = new Set<number>();
		for (const entry of [...value.entries].sort((a, b) => a.line - b.line)) {
			if (entry.env === "*" || envUpdates[entry.env] !== undefined) continue;
			let start = entry.line - 1;
			if (entry.when) {
				while (
					start > variable.line - 1 &&
					!lines[start]!.includes(`when ${entry.when.param} = ${entry.when.value}`)
				) {
					start--;
				}
			}
			if (seenLines.has(start)) continue;
			seenLines.add(start);
			const end = findDeclarationEndLine(source, start);
			existingEntries.push(
				lines
					.slice(start, end + 1)
					.map((line) => (indent && line.startsWith(indent) ? line.slice(indent.length) : line)),
			);
		}
		result = [];
		if (envUpdates.default !== undefined) {
			result.push(
				`${prefix}${variable.name}${schemaStr} = ${serializeVarsValue(envUpdates.default)} {`,
			);
		} else if (defaultEntry) {
			const defaultValue =
				defaultEntry.value.kind === "encrypted"
					? defaultEntry.value.raw
					: defaultEntry.value.kind === "interpolated"
						? serializeVarsValue(defaultEntry.value.template)
						: defaultEntry.value.kind === "literal"
							? serializeParsedVarsValue(defaultEntry.value.value)
							: null;
			result.push(
				defaultValue === null
					? `${prefix}${variable.name}${schemaStr} {`
					: `${prefix}${variable.name}${schemaStr} = ${defaultValue} {`,
			);
		} else {
			result.push(`${prefix}${variable.name}${schemaStr} {`);
		}
		for (const entryLines of existingEntries) result.push(...entryLines);
		for (const [env, updatedValue] of Object.entries(envUpdates)) {
			if (env !== "default") result.push(`  ${env} = ${serializeVarsValue(updatedValue)}`);
		}
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
		} else if (value?.kind === "encrypted") {
			result.push(`${prefix}${variable.name}${schemaStr} = ${value.raw} {`);
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

type PlaintextSecretMap = Map<string, string>;

function collectPlaintextSecrets(content: string, file: string): PlaintextSecretMap {
	const parsed = parseOrThrow(content, file);
	const plaintext = new Map<string, string>();
	for (const declaration of parsed.ast.declarations) {
		const group = declaration.kind === "group" ? declaration.name : "";
		const variables = declaration.kind === "group" ? declaration.declarations : [declaration];
		for (const variable of variables) {
			if (!variable.public) {
				collectPlaintextValue(variable.value, `${group}\0${variable.name}\0default`, plaintext);
			}
		}
	}
	return plaintext;
}

function collectPlaintextValue(
	value: VariableDecl["value"] | undefined,
	path: string,
	plaintext: PlaintextSecretMap,
): void {
	if (!value || value.kind === "encrypted") return;
	if (value.kind === "literal") {
		plaintext.set(path, JSON.stringify(["literal", value.value]));
		return;
	}
	if (value.kind === "interpolated") {
		plaintext.set(path, JSON.stringify(["interpolated", value.template]));
		return;
	}
	if (value.kind === "env_block") {
		for (const [index, entry] of value.entries.entries()) {
			const condition = entry.when ? `${entry.when.param}=${entry.when.value}` : "";
			collectPlaintextValue(
				entry.value,
				`${path}\0env:${entry.env}:${condition}:${index}`,
				plaintext,
			);
		}
		return;
	}
	for (const [index, clause] of value.whens.entries()) {
		const clausePath = `${path}\0when:${clause.param}=${clause.value}:${index}`;
		if (Array.isArray(clause.result)) {
			for (const [entryIndex, entry] of clause.result.entries()) {
				collectPlaintextValue(
					entry.value,
					`${clausePath}\0env:${entry.env}:${entryIndex}`,
					plaintext,
				);
			}
		} else {
			collectPlaintextValue(clause.result, clausePath, plaintext);
		}
	}
	collectPlaintextValue(value.fallback, `${path}\0fallback`, plaintext);
}

function hasNewPlaintextSecret(original: PlaintextSecretMap, updated: PlaintextSecretMap): boolean {
	for (const [site, value] of updated) {
		if (original.get(site) !== value) return true;
	}
	return false;
}
