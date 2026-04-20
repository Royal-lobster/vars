import type { ResolvedVars } from "./types.js";

/**
 * Build the serverless `#vars` module source.
 *
 * Assumes every env in `byEnv` declares the same set of variables. The first
 * env is used as the structural reference for both public vars (whose values
 * are expected to be identical across envs) and the list of secret names.
 * Divergent variable sets across envs will silently produce a bundle that
 * references only the reference env's vars.
 */
export function generateServerless(byEnv: Record<string, ResolvedVars>): string {
	const envNames = Object.keys(byEnv);
	if (envNames.length === 0) throw new Error("generateServerless: no envs provided");

	// Assume all envs share the same variable set; use the first as reference.
	const ref = byEnv[envNames[0]];
	const publicVars = ref.vars.filter((v) => v.public);
	const secretVars = ref.vars.filter((v) => !v.public);

	const lines: string[] = [];

	// PUBLIC_VARS block — literal values, identical across envs.
	lines.push("const PUBLIC_VARS = {");
	for (const v of publicVars) {
		lines.push(`  ${v.name}: ${JSON.stringify(v.value)},`);
	}
	lines.push("} as const;");
	lines.push("");

	// CIPHERTEXTS block — per-env ciphertext tokens.
	lines.push("const CIPHERTEXTS = {");
	for (const env of envNames) {
		lines.push(`  ${JSON.stringify(env)}: {`);
		for (const v of secretVars) {
			const val = byEnv[env].vars.find((x) => x.name === v.name)?.value;
			lines.push(`    ${v.name}: ${JSON.stringify(val ?? "")},`);
		}
		lines.push("  },");
	}
	lines.push("} as const;");

	lines.push("");
	lines.push(EMBEDDED_CRYPTO_HELPERS);

	// TODO(task-5): replace with real body
	lines.push("\nfunction wrapRedacted(parsed: any): Vars { return parsed as Vars; }");

	const envUnion = envNames.map((e) => JSON.stringify(e)).join(" | ");
	lines.push(`
let cache: Promise<Vars> | null = null;

export async function getVars(
  env: { VARS_KEY?: string; VARS_ENV?: string } & Record<string, unknown>,
  envOverride?: ${envUnion},
): Promise<Vars> {
  if (cache) return cache;
  const inflight = (async () => {
    const targetEnv = envOverride ?? (env.VARS_ENV as ${envUnion} | undefined);
    if (!targetEnv) throw new Error("vars: VARS_ENV not set and no override passed");
    if (!(targetEnv in CIPHERTEXTS)) throw new Error("vars: unknown env \\\"" + targetEnv + "\\\"");
    if (!env.VARS_KEY) throw new Error("vars: VARS_KEY not set in runtime env");
    const masterKey = base64ToBytes(env.VARS_KEY);
    const raw: Record<string, unknown> = { ...PUBLIC_VARS };
    for (const [name, token] of Object.entries(CIPHERTEXTS[targetEnv])) {
      raw[name] = await decryptToken(token, masterKey);
    }
    const parsed = schema.parse(raw);
    return wrapRedacted(parsed);
  })();
  cache = inflight;
  inflight.catch(() => {
    if (cache === inflight) cache = null;
  });
  return inflight;
}
`);

	return lines.join("\n");
}

const EMBEDDED_CRYPTO_HELPERS = `
function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hkdfSha256(master: Uint8Array, salt: string, info: string, length: number): Promise<Uint8Array> {
  const saltBytes = new TextEncoder().encode(salt);
  const infoBytes = new TextEncoder().encode(info);
  const baseKey = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: infoBytes },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function decryptToken(token: string, masterKey: Uint8Array): Promise<string> {
  const PREFIX = "enc:v2:aes256gcm-det:";
  if (!token.startsWith(PREFIX)) throw new Error("vars: invalid token format");
  const rest = token.slice(PREFIX.length);
  const parts = rest.split(":");
  let owner: string | null = null;
  let iv: string, ct: string, tag: string;
  if (parts.length === 4 && parts[0].startsWith("owner=")) {
    owner = parts[0].slice("owner=".length);
    [, iv, ct, tag] = parts;
  } else if (parts.length === 3) {
    [iv, ct, tag] = parts;
  } else {
    throw new Error("vars: malformed token");
  }
  let aesKey = masterKey;
  if (owner) aesKey = await hkdfSha256(masterKey, "dotvars-owner-key-v1", "owner:" + owner, 32);
  const key = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const ivBytes = base64ToBytes(iv);
  const ctBytes = base64ToBytes(ct);
  const tagBytes = base64ToBytes(tag);
  const combined = new Uint8Array(ctBytes.length + tagBytes.length);
  combined.set(ctBytes, 0);
  combined.set(tagBytes, ctBytes.length);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, combined);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("vars: decryption failed — wrong VARS_KEY or tampered ciphertext");
  }
}
`;
