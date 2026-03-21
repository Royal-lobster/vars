import keytar from "keytar";

const SERVICE = "vars";
const ACCOUNT = "master-key";

export async function storeKey(key: Buffer): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, key.toString("base64"));
}

export async function retrieveKey(): Promise<Buffer | null> {
  const stored = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!stored) return null;
  return Buffer.from(stored, "base64");
}

export async function clearKey(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
