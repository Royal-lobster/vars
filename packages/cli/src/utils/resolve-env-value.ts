import { isEncrypted } from "@dotvars/core";
import { decrypt } from "@dotvars/node";

export async function resolveEnvValue(
	value: string,
	loadKey: () => Promise<Buffer>,
): Promise<string | undefined> {
	if (!isEncrypted(value)) return value;

	const key = await loadKey();

	try {
		return decrypt(value, key);
	} catch {
		return undefined;
	}
}
