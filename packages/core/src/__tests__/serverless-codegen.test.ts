import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { generateServerless } from "../serverless-codegen.js";
import type { ResolvedVars } from "../types.js";

function vars(value: string, name = "SECRET", isPublic = false): ResolvedVars {
	return {
		vars: [{ name, flatName: name, public: isPublic, schema: "z.string()", value, metadata: null }],
		checks: [],
		envs: [],
		params: [],
		sourceFiles: ["/tmp/config.vars"],
	};
}

describe("generateServerless — ciphertext collection", () => {
	it("rejects plaintext private values", () => {
		expect(() => generateServerless({ dev: vars("plaintext") })).toThrow(
			/requires encrypted secret/,
		);
	});
	it("emits a CIPHERTEXTS object keyed by env", () => {
		const byEnv = {
			dev: vars("enc:v2:aes256gcm-det:aa:bb:cc"),
			prod: vars("enc:v2:aes256gcm-det:dd:ee:ff"),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain("const CIPHERTEXTS = {");
		expect(code).toContain('"dev":');
		expect(code).toContain('"prod":');
		expect(code).toContain('"enc:v2:aes256gcm-det:aa:bb:cc"');
		expect(code).toContain('"enc:v2:aes256gcm-det:dd:ee:ff"');
	});

	it("emits public vars as per-env plaintext in PUBLIC_VARS", () => {
		const byEnv = {
			dev: vars("my-app", "APP_NAME", true),
			prod: vars("my-app", "APP_NAME", true),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain("const PUBLIC_VARS = {");
		expect(code).toContain("APP_NAME: {");
		expect(code).toContain('"dev": "my-app"');
		expect(code).toContain('"prod": "my-app"');
	});
});

describe("generateServerless — platform marker", () => {
	it("emits the @vars-platform: serverless marker", () => {
		const byEnv = {
			dev: vars("enc:v2:aes256gcm-det:aa:bb:cc"),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain("// @vars-platform: serverless");
	});
});

describe("generateServerless — validation", () => {
	it("throws when byEnv is empty", () => {
		expect(() => generateServerless({})).toThrow("generateServerless: no envs provided");
	});
});

describe("generateServerless — embedded crypto helpers", () => {
	it("emits base64, HKDF, and AES-GCM decrypt helpers", () => {
		const byEnv = {
			dev: vars("enc:v2:aes256gcm-det:aa:bb:cc"),
		};
		const code = generateServerless(byEnv);
		expect(code).toMatch(/function base64ToBytes/);
		expect(code).toMatch(/function hkdfSha256/);
		expect(code).toMatch(/async function decryptToken/);
		expect(code).toContain("crypto.subtle.importKey");
		expect(code).toContain("AES-GCM");
		expect(code).toContain("dotvars-owner-key-v1"); // HKDF salt must match @vars/node
	});

	it("emits code that typechecks with noUncheckedIndexedAccess", () => {
		const byEnv = {
			dev: vars("enc:v2:aes256gcm-det:aa:bb:cc"),
		};
		const dir = join(process.cwd(), `.tmp-serverless-typecheck-${Date.now()}`);
		const filePath = join(dir, "config.generated.ts");

		try {
			mkdirSync(dir, { recursive: true });
			writeFileSync(filePath, generateServerless(byEnv));

			const program = ts.createProgram([filePath], {
				esModuleInterop: true,
				lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
				module: ts.ModuleKind.Node16,
				moduleResolution: ts.ModuleResolutionKind.Node16,
				noEmit: true,
				noUncheckedIndexedAccess: true,
				skipLibCheck: true,
				strict: true,
				target: ts.ScriptTarget.ES2022,
				types: ["node"],
			});
			const diagnostics = ts.getPreEmitDiagnostics(program);
			expect(
				diagnostics.map((diagnostic) =>
					ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
				),
			).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("generateServerless — getVars shape", () => {
	it("emits async getVars that memoizes per env+key and reads VARS_ENV by default", () => {
		const byEnv = {
			dev: vars("enc:v2:aes256gcm-det:aa:bb:cc"),
			prod: vars("enc:v2:aes256gcm-det:dd:ee:ff"),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain("export async function getVars");
		expect(code).toContain("env.VARS_ENV");
		expect(code).toContain("env.VARS_KEY");
		expect(code).toMatch(/const\s+cache\s*=\s*new\s+Map<string,\s*Promise<Vars>>/);
		expect(code).toContain('const cacheKey = targetEnv + ":" + env.VARS_KEY');
		expect(code).toContain("cache.get(cacheKey)");
		expect(code).toContain("cache.delete(cacheKey)");
		expect(code).toContain('throw new Error("vars: VARS_KEY not set');
		expect(code).toContain('throw new Error("vars: VARS_ENV not set');
		expect(code).toContain("schema.parse");
		expect(code).toContain("inflight.catch(");
	});
});

describe("generateServerless — grouped vars", () => {
	it("nests grouped secret ciphertexts so schema.parse sees the group shape", () => {
		const byEnv = {
			dev: {
				vars: [
					{
						name: "url",
						flatName: "DB_URL",
						public: false,
						schema: "z.string().url()",
						value: "enc:v2:aes256gcm-det:a:b:c",
						metadata: null,
						group: "db",
					},
					{
						name: "password",
						flatName: "DB_PASSWORD",
						public: false,
						schema: "z.string()",
						value: "enc:v2:aes256gcm-det:d:e:f",
						metadata: null,
						group: "db",
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: [],
			},
		};
		const code = generateServerless(byEnv as unknown as Record<string, ResolvedVars>);
		// CIPHERTEXTS must nest under the group name.
		expect(code).toMatch(/"dev":\s*\{\s*db:\s*\{/);
		expect(code).toContain('url: "enc:v2:aes256gcm-det:a:b:c"');
		expect(code).toContain('password: "enc:v2:aes256gcm-det:d:e:f"');
		// Runtime loop must reassemble groups before schema.parse.
		expect(code).toContain('typeof value === "string"');
	});

	it("nests grouped public vars inside PUBLIC_VARS", () => {
		const byEnv = {
			dev: {
				vars: [
					{
						name: "region",
						flatName: "AWS_REGION",
						public: true,
						schema: "z.string()",
						value: "us-east-1",
						metadata: null,
						group: "aws",
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: [],
			},
		};
		const code = generateServerless(byEnv as unknown as Record<string, ResolvedVars>);
		expect(code).toMatch(/const PUBLIC_VARS = \{\s*aws:\s*\{\s*region:\s*\{/);
		expect(code).toContain('"dev": "us-east-1"');
	});
});

describe("generateServerless — public var divergence", () => {
	it("emits different public values across envs", () => {
		const byEnv = {
			dev: vars("https://dev.api", "API_URL", true),
			prod: vars("https://api.example.com", "API_URL", true),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain('"dev": "https://dev.api"');
		expect(code).toContain('"prod": "https://api.example.com"');
		expect(code).toContain("selectPublicValue(v, targetEnv)");
	});

	it("accepts a public var when all envs agree on the value", () => {
		const byEnv = {
			dev: vars("my-app", "APP_NAME", true),
			prod: vars("my-app", "APP_NAME", true),
		};
		expect(() => generateServerless(byEnv)).not.toThrow();
	});

	it("emits different grouped public values across envs", () => {
		const byEnv: Record<string, ResolvedVars> = {
			dev: {
				vars: [
					{
						name: "region",
						flatName: "AWS_REGION",
						public: true,
						schema: "z.string()",
						value: "us-east-1",
						metadata: null,
						group: "aws",
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: [],
			},
			prod: {
				vars: [
					{
						name: "region",
						flatName: "AWS_REGION",
						public: true,
						schema: "z.string()",
						value: "eu-west-1",
						metadata: null,
						group: "aws",
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: [],
			},
		};
		const code = generateServerless(byEnv);
		expect(code).toMatch(/aws:\s*\{\s*region:\s*\{/);
		expect(code).toContain('"dev": "us-east-1"');
		expect(code).toContain('"prod": "eu-west-1"');
	});
});

describe("generateServerless — schema + Redacted", () => {
	it("redacts and JSON-decodes private compound values", () => {
		const resolved = vars("enc:v2:aes256gcm-det:a:b:c");
		resolved.vars[0]!.schema = "z.array(z.string())";
		const code = generateServerless({ dev: resolved });
		expect(code).toContain("SECRET: Redacted<unknown[]>");
		expect(code).toContain('JSON.parse(raw["SECRET"]');
		expect(code).toContain('new Redacted(parsed["SECRET"] as unknown[])');
	});

	it("emits the same schema block and Redacted wrapping as node codegen", () => {
		const byEnv = {
			dev: {
				vars: [
					{
						name: "PORT",
						flatName: "PORT",
						public: true,
						schema: "z.coerce.number()",
						value: "3000",
						metadata: null,
					},
					{
						name: "DB",
						flatName: "DB",
						public: false,
						schema: "z.string().url()",
						value: "enc:v2:aes256gcm-det:a:b:c",
						metadata: null,
					},
				],
				checks: [],
				envs: [],
				params: [],
				sourceFiles: [],
			},
		};
		const code = generateServerless(byEnv as any);
		expect(code).toContain("const schema = z.object(");
		expect(code).toContain("PORT: z.coerce.number()");
		expect(code).toContain("DB: z.string().url()");
		expect(code).toContain('new Redacted(parsed["DB"]');
		expect(code).toContain('PORT: parsed["PORT"] as number');
	});
});
