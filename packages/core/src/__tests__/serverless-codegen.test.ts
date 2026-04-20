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

describe("generateServerless — validation", () => {
	it("throws when byEnv is empty", () => {
		expect(() => generateServerless({})).toThrow("generateServerless: no envs provided");
	});
});
