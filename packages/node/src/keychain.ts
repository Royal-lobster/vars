export async function storeKey(key: Buffer): Promise<void> {
	const keytar = await import("keytar");
	await keytar.default.setPassword("vars", "master-key", key.toString("base64"));
}

export async function retrieveKey(): Promise<Buffer | null> {
	const keytar = await import("keytar");
	const val = await keytar.default.getPassword("vars", "master-key");
	return val ? Buffer.from(val, "base64") : null;
}

export async function clearKey(): Promise<void> {
	const keytar = await import("keytar");
	await keytar.default.deletePassword("vars", "master-key");
}
