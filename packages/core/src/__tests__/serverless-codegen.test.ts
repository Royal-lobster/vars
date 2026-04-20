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

	it("inlines public vars as plaintext in PUBLIC_VARS", () => {
		const byEnv = {
			dev: vars("my-app", "APP_NAME", true),
			prod: vars("my-app", "APP_NAME", true),
		};
		const code = generateServerless(byEnv);
		expect(code).toContain("const PUBLIC_VARS = {");
		expect(code).toContain('APP_NAME: "my-app"');
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
		expect(code).toMatch(/const PUBLIC_VARS = \{\s*aws:\s*\{\s*region:\s*"us-east-1"/);
	});
});

describe("generateServerless — public var divergence", () => {
	it("throws when a public var has different values across envs", () => {
		const byEnv = {
			dev: vars("https://dev.api", "API_URL", true),
			prod: vars("https://api.example.com", "API_URL", true),
		};
		expect(() => generateServerless(byEnv)).toThrow(
			/public variable "API_URL" has divergent values/,
		);
	});

	it("accepts a public var when all envs agree on the value", () => {
		const byEnv = {
			dev: vars("my-app", "APP_NAME", true),
			prod: vars("my-app", "APP_NAME", true),
		};
		expect(() => generateServerless(byEnv)).not.toThrow();
	});

	it("reports grouped public vars using group.name notation", () => {
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
		expect(() => generateServerless(byEnv)).toThrow(/"aws\.region"/);
	});
});

describe("generateServerless — schema + Redacted", () => {
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
		expect(code).toContain("new Redacted(parsed.DB");
		expect(code).toContain("PORT: parsed.PORT as number");
	});
});
