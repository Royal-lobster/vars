import { isEncrypted, parseEncryptedToken } from "@dotvars/core";
import { decrypt, deriveOwnerKey, type KeyScope } from "@dotvars/node";

export async function resolveEnvValue(
	value: string,
	loadKey: () => Promise<{ key: Buffer; scope: KeyScope }>,
): Promise<string> {
	if (!isEncrypted(value)) return value;

	const { key, scope } = await loadKey();
	const owner = parseEncryptedToken(value)?.owner;
	if (scope !== "master" && owner !== scope.owner) {
		throw new Error(`Secret belongs to owner "${owner ?? "master"}", not "${scope.owner}"`);
	}
	return decrypt(value, scope === "master" && owner ? await deriveOwnerKey(key, owner) : key);
}
