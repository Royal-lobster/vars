import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isEncrypted, parse, parseEncryptedToken } from "@dotvars/core";
import { decrypt, deriveOwnerKey, encryptDeterministic } from "./crypto.js";
import { isUnlockedPath, toLockedPath, toUnlockedPath } from "./unlocked-path.js";

export type KeyScope = "master" | { owner: string };

export async function showFile(filePath: string, key: Buffer, scope?: KeyScope): Promise<string> {
	const unlockedPath = isUnlockedPath(filePath) ? filePath : toUnlockedPath(filePath);

	if (!isUnlockedPath(filePath) && existsSync(filePath)) {
		renameSync(filePath, unlockedPath);
	}

	const content = readFileSync(unlockedPath, "utf8");
	const lines = content.split("\n");
	const result: string[] = [];
	const effectiveScope = scope ?? "master";
	const ownerKeyCache = new Map<string, Buffer>();

	for (const line of lines) {
		const match = line.match(/^(.*=\s*)(enc:v2:\S+)(.*)$/);
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
				const escaped = decrypted.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
				result.push(`${prefix}"${escaped}"${suffix}`);
			} else {
				if (parsed?.owner === effectiveScope.owner) {
					const decrypted = decrypt(encrypted, key);
					const escaped = decrypted.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
					result.push(`${prefix}"${escaped}"${suffix}`);
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
	const publicVars = new Set<string>();
	const ownerMap = new Map<string, string>();

	for (const decl of parsed.ast.declarations) {
		if (decl.kind === "variable") {
			if (decl.public) publicVars.add(decl.name);
			if (decl.metadata?.owner) ownerMap.set(decl.name, decl.metadata.owner);
		}
		if (decl.kind === "group") {
			for (const v of decl.declarations) {
				if (v.public) publicVars.add(v.name);
				if (v.metadata?.owner) ownerMap.set(v.name, v.metadata.owner);
			}
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

	for (const line of lines) {
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

		const groupMatch = line.match(/^group\s+(\w+)\s*\{/);
		if (groupMatch) {
			currentGroup = groupMatch[1];
		}

		if (currentGroup && line.trim() === "}" && !line.match(/^\s{2,}/)) {
			currentGroup = null;
		}

		const varMatch = line.match(/^\s*(?:public\s+)?([A-Z][A-Z0-9_]*)\s*[:{=]/);
		if (varMatch) {
			currentVar = varMatch[1];
			currentIsPublic = line.trimStart().startsWith("public") || publicVars.has(currentVar);
		}

		const currentOwner = currentVar ? (ownerMap.get(currentVar) ?? null) : null;
		const inScope =
			effectiveScope === "master" ||
			(currentOwner !== null &&
				typeof effectiveScope === "object" &&
				currentOwner === effectiveScope.owner);

		// Schema-with-default lines
		const schemaDefaultMatch = line.match(
			/^(\s*(?:public\s+)?[A-Z][A-Z0-9_]*\s*:\s*[^=]+=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/,
		);
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
		if (envMatch && !currentIsPublic && inScope) {
			const [, prefix, rawValue, suffix] = envMatch;
			if (line.match(/^\s*(?:public\s+)?[A-Z][A-Z0-9_]*\s*:.*\{\s*$/)) {
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
