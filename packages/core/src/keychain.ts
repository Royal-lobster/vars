const SERVICE = "vars";
const ACCOUNT = "master-key";

async function getKeytar() {
  const keytar = await import("keytar");
  return keytar.default;
}

export async function storeKey(key: Buffer): Promise<void> {
  const keytar = await getKeytar();
  await keytar.setPassword(SERVICE, ACCOUNT, key.toString("base64"));
}

export async function retrieveKey(): Promise<Buffer | null> {
  const keytar = await getKeytar();
  const stored = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!stored) return null;
  return Buffer.from(stored, "base64");
}

export async function clearKey(): Promise<void> {
  const keytar = await getKeytar();
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
