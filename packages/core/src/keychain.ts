let keytar: typeof import("keytar") | null = null;

const SERVICE = "vars";
const ACCOUNT = "master-key";

async function getKeytar() {
  if (keytar) return keytar;
  try {
    keytar = await import("keytar");
    return keytar;
  } catch {
    throw new Error(
      "keytar is required for keychain operations but not installed. " +
      "Install it with: pnpm add keytar"
    );
  }
}

export async function storeKey(key: Buffer): Promise<void> {
  const kt = await getKeytar();
  await kt.setPassword(SERVICE, ACCOUNT, key.toString("base64"));
}

export async function retrieveKey(): Promise<Buffer | null> {
  const kt = await getKeytar();
  const stored = await kt.getPassword(SERVICE, ACCOUNT);
  if (!stored) return null;
  return Buffer.from(stored, "base64");
}

export async function clearKey(): Promise<void> {
  const kt = await getKeytar();
  await kt.deletePassword(SERVICE, ACCOUNT);
}
