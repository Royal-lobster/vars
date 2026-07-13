import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { type Value, isEncrypted, parse, parseEncryptedToken } from "@dotvars/core";
import { decrypt, deriveOwnerKey, encryptDeterministic } from "./crypto.js";
import { isUnlockedPath, toLockedPath, toUnlockedPath } from "./unlocked-path.js";

export type KeyScope = "master" | { owner: string };

export async function showFile(filePath: string, key: Buffer, scope?: KeyScope): Promise<string> {
	const unlockedPath = isUnlockedPath(filePath) ? filePath : toUnlockedPath(filePath);

	if (!isUnlockedPath(filePath) && existsSync(filePath)) {
		if (existsSync(unlockedPath)) {
			throw new Error(`Refusing to overwrite existing unlocked file: ${unlockedPath}`);
		}
		renameSync(filePath, unlockedPath);
	}

	const content = readFileSync(unlockedPath, "utf8");
	const lines = content.split("\n");
	const result: string[] = [];
	const effectiveScope = scope ?? "master";
	const ownerKeyCache = new Map<string, Buffer>();

	for (const line of lines) {
		const match = line.match(/^(.*?(?:=>|=)\s*)(enc:v2:\S+)(.*)$/);
		if (match) {
			const [, prefix, encrypted, suffix] = match;
			const parsed = parseEncryptedToken(encrypted);

			if (effectiveScope === "master") {
				let decryptKey = key;
				if (parsed?.owner) {
					if (!ownerKeyCache.has(parsed.owner)) {
						ownerKeyCache.set(parsed.owner, await deriveOwnerKey(key, parsed.owner));
					}
					decryptKey = ownerKeyCache.get(parsed.owner)!;
				}
				const decrypted = decrypt(encrypted, decryptKey);
				result.push(`${prefix}${serializeDecrypted(decrypted)}${suffix}`);
			} else {
				if (parsed?.owner === effectiveScope.owner) {
					const decrypted = decrypt(encrypted, key);
					result.push(`${prefix}${serializeDecrypted(decrypted)}${suffix}`);
				} else {
					result.push(line);
				}
			}
			continue;
		}
		result.push(line);
	}

	writeFileSync(unlockedPath, result.join("\n"));
	return unlockedPath;
}

export async function hideFile(filePath: string, key: Buffer, scope?: KeyScope): Promise<string> {
	const lockedPath = isUnlockedPath(filePath) ? toLockedPath(filePath) : filePath;
	const readPath = filePath;

	const content = readFileSync(readPath, "utf8");
	const parsed = parse(content, readPath);
	if (parsed.errors.length > 0) {
		throw new Error(`Cannot safely encrypt invalid vars file: ${parsed.errors[0]!.message}`);
	}
	const publicVars = new Set<string>();
	const ownerMap = new Map<string, string>();
	const multilineValues = new Map<string, string>();
	const declarationsByLine = new Map<number, { name: string; group: string | null }>();
	const identity = (group: string | null, name: string) => `${group ?? ""}\0${name}`;

	for (const decl of parsed.ast.declarations) {
		if (decl.kind === "variable") {
			declarationsByLine.set(decl.line, { name: decl.name, group: null });
			if (decl.public) publicVars.add(identity(null, decl.name));
			if (decl.metadata?.owner) ownerMap.set(identity(null, decl.name), decl.metadata.owner);
			collectMultilineValues(decl.value, identity(null, decl.name), multilineValues);
		}
		if (decl.kind === "group") {
			for (const v of decl.declarations) {
				declarationsByLine.set(v.line, { name: v.name, group: decl.name });
				if (v.public) publicVars.add(identity(decl.name, v.name));
				if (v.metadata?.owner) ownerMap.set(identity(decl.name, v.name), v.metadata.owner);
				collectMultilineValues(v.value, identity(decl.name, v.name), multilineValues);
			}
		}
	}
	for (const owner of ownerMap.values()) {
		if (/[:\s]/.test(owner)) {
			throw new Error(`Invalid owner "${owner}": colons and whitespace are not allowed`);
		}
	}

	const effectiveScope = scope ?? "master";
	const ownerKeyCache = new Map<string, Buffer>();

	const lines = content.split("\n");
	const result: string[] = [];
	let currentVar: string | null = null;
	let currentIsPublic = false;
	let currentGroup: string | null = null;
	let checkDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (line.match(/^\s*check\s+/)) {
			if (line.includes("{")) checkDepth = 1;
			result.push(line);
			continue;
		}

		if (checkDepth > 0) {
			for (const ch of line) {
				if (ch === "{") checkDepth++;
				else if (ch === "}") checkDepth--;
			}
			result.push(line);
			continue;
		}

		const groupMatch = line.match(/^group\s+([\w-]+)\s*\{/);
		if (groupMatch) {
			currentGroup = groupMatch[1];
		}

		if (currentGroup && line.trim() === "}" && !line.match(/^\s{2,}/)) {
			currentGroup = null;
		}

		const declaration = declarationsByLine.get(i + 1);
		if (declaration) {
			currentVar = declaration.name;
			currentGroup = declaration.group;
			currentIsPublic = publicVars.has(identity(currentGroup, currentVar));
		}

		const currentOwner = currentVar
			? (ownerMap.get(identity(currentGroup, currentVar)) ?? null)
			: null;
		const inScope =
			effectiveScope === "master" ||
			(currentOwner !== null &&
				typeof effectiveScope === "object" &&
				currentOwner === effectiveScope.owner);

		// Schema-with-default lines
		const schemaDefaultMatch = line.match(
			/^(\s*(?:public\s+)?[A-Za-z_][A-Za-z0-9_-]*\s*:\s*[^=]+=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/,
		);
		if (!currentIsPublic && inScope && line.includes('"""')) {
			const opening = line.indexOf('"""');
			let closingLine = i;
			let closing = line.indexOf('"""', opening + 3);
			while (closing < 0 && ++closingLine < lines.length) {
				closing = lines[closingLine]!.indexOf('"""');
			}
			const value = currentVar
				? multilineValues.get(`${identity(currentGroup, currentVar)}\0${i + 1}`)
				: undefined;
			if (closing < 0 || value === undefined) {
				throw new Error(`Cannot safely encrypt multiline secret ${currentVar ?? "value"}`);
			}
			const context = `${currentGroup ? `${currentGroup.toUpperCase()}_` : ""}${currentVar}@${i + 1}`;
			const encKey = await getEncryptionKey(key, currentOwner, effectiveScope, ownerKeyCache);
			const suffix = lines[closingLine]!.slice(closing + 3);
			result.push(
				`${line.slice(0, opening)}${encryptDeterministic(value, encKey, context, currentOwner ?? undefined)}${suffix}`,
			);
			i = closingLine;
			continue;
		}
		if (schemaDefaultMatch && !currentIsPublic && inScope) {
			const [, prefix, rawValue, suffix] = schemaDefaultMatch;
			if (!rawValue.startsWith('"') && !rawValue.startsWith("'")) {
				result.push(line);
				continue;
			}
			const value = rawValue.slice(1, -1);
			if (isEncrypted(value)) {
				result.push(line);
				continue;
			}
			const context = currentGroup
				? `${currentGroup.toUpperCase()}_${currentVar}@default`
				: `${currentVar}@default`;
			const encKey = await getEncryptionKey(key, currentOwner, effectiveScope, ownerKeyCache);
			const encrypted = encryptDeterministic(value, encKey, context, currentOwner ?? undefined);
			result.push(`${prefix}${encrypted}${suffix}`);
			continue;
		}

		// Env-block value assignment lines
		const envMatch = line.match(
			/^(\s*\w[\w-]*\s*=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/,
		);
		const conditionalEncrypted = line.match(
			/^\s*(?:when\s+[\w-]+\s*=\s*[\w-]+|else)\s*=>\s*(enc:v2:\S+)/,
		);
		if (conditionalEncrypted && !currentIsPublic && inScope) {
			result.push(line);
			continue;
		}
		const conditionalMatch = line.match(
			/^(\s*(?:when\s+[\w-]+\s*=\s*[\w-]+|else)\s*=>\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(.*)$/,
		);
		if (conditionalMatch && !currentIsPublic && inScope) {
			const [, prefix, rawValue, suffix] = conditionalMatch;
			const value = rawValue.slice(1, -1);
			const context = currentGroup
				? `${currentGroup.toUpperCase()}_${currentVar}@conditional`
				: `${currentVar}@conditional`;
			const encKey = await getEncryptionKey(key, currentOwner, effectiveScope, ownerKeyCache);
			result.push(
				`${prefix}${encryptDeterministic(value, encKey, context, currentOwner ?? undefined)}${suffix}`,
			);
			continue;
		}
		if (!currentIsPublic && inScope && /(?:^|\s)(?:when\s+|else\s*=>)/.test(line)) {
			throw new Error(
				`Cannot safely encrypt non-string conditional secret ${currentVar ?? "value"}`,
			);
		}
		if (envMatch && !currentIsPublic && inScope) {
			const [, prefix, rawValue, suffix] = envMatch;
			if (line.match(/^\s*(?:public\s+)?[A-Za-z_][A-Za-z0-9_-]*\s*:.*\{\s*$/)) {
				result.push(line);
				continue;
			}
			const value =
				rawValue.startsWith('"') || rawValue.startsWith("'") ? rawValue.slice(1, -1) : rawValue;
			if (isEncrypted(value)) {
				result.push(line);
				continue;
			}
			if (rawValue.startsWith('"""')) {
				result.push(line);
				continue;
			}
			const envName = line.trim().split(/\s*=/)[0].trim();
			const context = currentGroup
				? `${currentGroup.toUpperCase()}_${currentVar}@${envName}`
				: `${currentVar}@${envName}`;
			const encKey = await getEncryptionKey(key, currentOwner, effectiveScope, ownerKeyCache);
			const encrypted = encryptDeterministic(value, encKey, context, currentOwner ?? undefined);
			result.push(`${prefix}${encrypted}${suffix}`);
			continue;
		}

		result.push(line);
	}

	writeFileSync(readPath, result.join("\n"));
	if (isUnlockedPath(readPath) && readPath !== lockedPath) {
		renameSync(readPath, lockedPath);
	}
	return lockedPath;
}

function serializeDecrypted(value: string): string {
	if (value.includes("\n")) return `"""\n${value}\n"""`;
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function collectMultilineValues(
	value: Value | null,
	identity: string,
	values: Map<string, string>,
): void {
	if (!value) return;
	if (value.kind === "literal" && typeof value.value === "string") {
		values.set(`${identity}\0${value.line}`, value.value);
	} else if (value.kind === "env_block") {
		for (const entry of value.entries) collectMultilineValues(entry.value, identity, values);
	} else if (value.kind === "conditional") {
		for (const clause of value.whens) {
			if (Array.isArray(clause.result)) {
				for (const entry of clause.result) collectMultilineValues(entry.value, identity, values);
			} else collectMultilineValues(clause.result, identity, values);
		}
		collectMultilineValues(value.fallback ?? null, identity, values);
	}
}

async function getEncryptionKey(
	key: Buffer,
	owner: string | null,
	scope: KeyScope,
	cache: Map<string, Buffer>,
): Promise<Buffer> {
	if (scope === "master" && owner) {
		if (!cache.has(owner)) {
			cache.set(owner, await deriveOwnerKey(key, owner));
		}
		return cache.get(owner)!;
	}
	return key;
}
