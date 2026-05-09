import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type ResolvedVars, generateTypeScript } from "@dotvars/core";
import { afterEach, describe, expect, it } from "vitest";
import { decrypt, deriveOwnerKey, encryptDeterministic } from "../crypto.js";
import { createMasterKey } from "../key-manager.js";
import { resolveAllEnvs } from "../resolve-multi-env.js";
import { hideFile } from "../show-hide.js";

// esbuild needs a resolveDir that can find "zod" when bundling the generated
// module; resolve it through @dotvars/core (which depends on zod) so the path
// is robust to monorepo layout changes.
const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve("@dotvars/core"));
const zodDir = dirname(coreRequire.resolve("zod/package.json"));

const hasSubtle = !!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle;

async function loadServerlessCode(code: string, dir: string): Promise<any> {
	const esbuild = await import("esbuild");
	const outPath = join(dir, `vars-${randomBytes(4).toString("hex")}.mjs`);
	await esbuild.build({
		stdin: { contents: code, loader: "ts", resolveDir: zodDir },
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node18",
		outfile: outPath,
		write: true,
		logLevel: "silent",
	});
	return import(pathToFileURL(outPath).href);
}

describe("serverless round-trip", () => {
	const tmpDirs: string[] = [];
	afterEach(() => {
		for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
		tmpDirs.length = 0;
	});

	it.skipIf(!hasSubtle)(
		"encrypt → codegen → eval → decrypt yields original plaintext",
		async () => {
			const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
			tmpDirs.push(dir);
			const file = join(dir, "config.vars");
			writeFileSync(
				file,
				`env(dev, prod)\n\npublic APP_NAME = "my-app"\nDATABASE_URL : z.string() {\n  dev = "postgres://dev"\n  prod = "postgres://prod"\n}\n`,
			);

			const key = await createMasterKey();
			await hideFile(file, key);

			const byEnv = resolveAllEnvs(file);
			const ref = byEnv.prod;
			const code = generateTypeScript(ref, { platform: "serverless", byEnv });

			const mod = await loadServerlessCode(code, dir);
			const vars = await mod.getVars({
				VARS_KEY: key.toString("base64"),
				VARS_ENV: "prod",
			});
			expect(vars.APP_NAME).toBe("my-app");
			expect(vars.DATABASE_URL.unwrap()).toBe("postgres://prod");
		},
	);

	it.skipIf(!hasSubtle)("decrypts grouped secrets nested under the group name", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const file = join(dir, "config.vars");
		writeFileSync(
			file,
			`env(dev)\n\ngroup db {\n  url : z.string() {\n    dev = "postgres://dev/app"\n  }\n  password : z.string() {\n    dev = "hunter2"\n  }\n}\n`,
		);

		const key = await createMasterKey();
		await hideFile(file, key);

		const byEnv = resolveAllEnvs(file);
		const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });

		const mod = await loadServerlessCode(code, dir);
		const vars = await mod.getVars({
			VARS_KEY: key.toString("base64"),
			VARS_ENV: "dev",
		});
		expect(vars.db.url.unwrap()).toBe("postgres://dev/app");
		expect(vars.db.password.unwrap()).toBe("hunter2");
	});

	it.skipIf(!hasSubtle)(
		"getVars memoizes per env+key so distinct inputs return distinct results",
		async () => {
			const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
			tmpDirs.push(dir);
			const file = join(dir, "config.vars");
			writeFileSync(
				file,
				`env(dev, prod)\n\nDATABASE_URL : z.string() {\n  dev = "postgres://dev"\n  prod = "postgres://prod"\n}\n`,
			);

			const key = await createMasterKey();
			await hideFile(file, key);

			const byEnv = resolveAllEnvs(file);
			const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });

			const mod = await loadServerlessCode(code, dir);
			const devVars = await mod.getVars({
				VARS_KEY: key.toString("base64"),
				VARS_ENV: "dev",
			});
			const prodVars = await mod.getVars({
				VARS_KEY: key.toString("base64"),
				VARS_ENV: "prod",
			});
			expect(devVars.DATABASE_URL.unwrap()).toBe("postgres://dev");
			expect(prodVars.DATABASE_URL.unwrap()).toBe("postgres://prod");
			// Same call returns the same memoized promise.
			const devVars2 = await mod.getVars({
				VARS_KEY: key.toString("base64"),
				VARS_ENV: "dev",
			});
			expect(devVars2).toBe(devVars);
		},
	);

	it.skipIf(!hasSubtle)("selects divergent public vars by env", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const file = join(dir, "config.vars");
		writeFileSync(
			file,
			`env(dev, prod)\n\npublic INBOUND_EMAIL_DOMAIN {\n  dev = "in-dev.example.com"\n  prod = "in.example.com"\n}\nSECRET {\n  dev = "dev-secret"\n  prod = "prod-secret"\n}\n`,
		);

		const key = await createMasterKey();
		await hideFile(file, key);

		const byEnv = resolveAllEnvs(file);
		const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });

		const mod = await loadServerlessCode(code, dir);
		const devVars = await mod.getVars({
			VARS_KEY: key.toString("base64"),
			VARS_ENV: "dev",
		});
		const prodVars = await mod.getVars({
			VARS_KEY: key.toString("base64"),
			VARS_ENV: "prod",
		});

		expect(devVars.INBOUND_EMAIL_DOMAIN).toBe("in-dev.example.com");
		expect(devVars.SECRET.unwrap()).toBe("dev-secret");
		expect(prodVars.INBOUND_EMAIL_DOMAIN).toBe("in.example.com");
		expect(prodVars.SECRET.unwrap()).toBe("prod-secret");
	});

	it.skipIf(!hasSubtle)(
		"owner-scoped HKDF subkey matches @dotvars/node Node-crypto path",
		async () => {
			const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
			tmpDirs.push(dir);

			const master = await createMasterKey();
			const owner = "alice";
			const subkey = await deriveOwnerKey(master, owner);
			const token = encryptDeterministic("my-secret", subkey, "ctx", owner);

			// Sanity: the Node-side decrypt round-trips with the derived subkey.
			expect(decrypt(token, subkey)).toBe("my-secret");

			const byEnv: Record<string, ResolvedVars> = {
				dev: {
					vars: [
						{
							name: "X",
							flatName: "X",
							public: false,
							schema: "z.string()",
							value: token,
							metadata: null,
						},
					],
					checks: [],
					envs: [],
					params: [],
					sourceFiles: ["/tmp/fake.vars"],
				},
			};

			const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });
			const mod = await loadServerlessCode(code, dir);
			const vars = await mod.getVars({
				VARS_KEY: master.toString("base64"),
				VARS_ENV: "dev",
			});
			expect(vars.X.unwrap()).toBe("my-secret");
		},
	);
});

describe("serverless runtime errors", () => {
	const tmpDirs: string[] = [];
	afterEach(() => {
		for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
		tmpDirs.length = 0;
	});

	async function buildModule(dir: string): Promise<{ mod: any; key: Buffer }> {
		const master = await createMasterKey();
		const token = encryptDeterministic("payload", master, "ctx");
		const byEnv: Record<string, ResolvedVars> = {
			dev: {
				vars: [
					{
						name: "S",
						flatName: "S",
						public: false,
						schema: "z.string()",
						value: token,
						metadata: null,
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: ["/tmp/fake.vars"],
			},
		};
		const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });
		const mod = await loadServerlessCode(code, dir);
		return { mod, key: master };
	}

	it.skipIf(!hasSubtle)("rejects when VARS_KEY is missing", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const { mod } = await buildModule(dir);
		await expect(mod.getVars({ VARS_ENV: "dev" })).rejects.toThrow(/VARS_KEY not set/);
	});

	it.skipIf(!hasSubtle)("rejects when VARS_ENV is missing and no override is passed", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const { mod, key } = await buildModule(dir);
		await expect(mod.getVars({ VARS_KEY: key.toString("base64") })).rejects.toThrow(
			/VARS_ENV not set/,
		);
	});

	it.skipIf(!hasSubtle)("rejects when override selects an unknown env", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const { mod, key } = await buildModule(dir);
		await expect(
			mod.getVars({ VARS_KEY: key.toString("base64"), VARS_ENV: "dev" }, "production"),
		).rejects.toThrow(/unknown env/);
	});

	it.skipIf(!hasSubtle)("rejects when VARS_KEY is wrong", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const { mod } = await buildModule(dir);
		await expect(
			mod.getVars({ VARS_KEY: Buffer.alloc(32).toString("base64"), VARS_ENV: "dev" }),
		).rejects.toThrow(/decryption failed/);
	});

	it.skipIf(!hasSubtle)("rejects when a ciphertext has been tampered with", async () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);

		const master = await createMasterKey();
		const token = encryptDeterministic("payload", master, "ctx");
		// Snip the last few base64 characters off the tag portion so AES-GCM
		// auth fails (or, if the slice spans part boundaries, the parser rejects
		// the token as malformed — either outcome is spec-valid here).
		const tampered = token.slice(0, -4);

		const byEnv: Record<string, ResolvedVars> = {
			dev: {
				vars: [
					{
						name: "S",
						flatName: "S",
						public: false,
						schema: "z.string()",
						value: tampered,
						metadata: null,
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: ["/tmp/fake.vars"],
			},
		};
		const code = generateTypeScript(byEnv.dev, { platform: "serverless", byEnv });
		const mod = await loadServerlessCode(code, dir);
		await expect(
			mod.getVars({ VARS_KEY: master.toString("base64"), VARS_ENV: "dev" }),
		).rejects.toThrow(/decryption failed|malformed token/);
	});
});
