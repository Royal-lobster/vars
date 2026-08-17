import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMasterKey, decrypt, deriveOwnerKey, encryptVarsContent } from "@dotvars/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectMutationValues, readValueFile } from "../utils/mutation-values.js";
import { mutateVarsFile, mutateVarsSource } from "../utils/vars-source-mutation.js";

function encryptedValue(content: string, target: string): string {
	const line = content
		.split("\n")
		.find((candidate) => candidate.trimStart().startsWith(`${target} =`));
	if (!line) throw new Error(`Missing ${target}`);
	return line.slice(line.indexOf("=") + 1).trim();
}

describe("locked vars mutations", () => {
	let directory: string;
	let file: string;
	let getMasterKey: () => Promise<{ key: Buffer; scope: "master" }>;
	let key: Buffer;

	beforeEach(async () => {
		directory = join(tmpdir(), `vars-locked-mutation-${Date.now()}-${Math.random()}`);
		mkdirSync(directory);
		file = join(directory, "config.vars");
		key = await createMasterKey();
		getMasterKey = async () => ({ key, scope: "master" });
		writeFileSync(
			file,
			await encryptVarsContent(
				'env(dev, prod)\n\npublic APP_NAME = "demo"\nAPI_TOKEN = "old-secret"\n',
				key,
			),
		);
	});

	afterEach(() => {
		rmSync(directory, { recursive: true, force: true });
	});

	it("refuses an explicit locked path while its unlocked counterpart exists", async () => {
		const unlocked = join(directory, "config.unlocked.vars");
		writeFileSync(unlocked, 'PUBLIC_VALUE = "open"\n');
		const before = readFileSync(file, "utf8");

		await expect(mutateVarsFile(file, { kind: "remove", target: "API_TOKEN" })).rejects.toThrow(
			"Run vars hide first",
		);
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it("rejects environment names that collide with credential flags", () => {
		expect(() =>
			collectMutationValues({ pin: "must-not-become-a-value" }, ["pin"], {
				broadcastShared: false,
				required: true,
			}),
		).toThrow('Environment name "pin" conflicts with a vars command flag');
	});

	it("adds grouped public and secret values without creating an unlocked file", async () => {
		await mutateVarsFile(file, {
			kind: "add",
			target: "stripe.PUBLISHABLE_KEY",
			public: true,
			schema: "z.string()",
			values: { default: "pk_test_public" },
		});
		await mutateVarsFile(
			file,
			{
				kind: "add",
				target: "stripe.SECRET_KEY",
				public: false,
				schema: "z.string()",
				values: { default: "sk_test_secret" },
			},
			{ getKey: getMasterKey },
		);

		const content = readFileSync(file, "utf8");
		expect(content).toContain("group stripe {");
		expect(content).toContain('public PUBLISHABLE_KEY = "pk_test_public"');
		expect(content).not.toContain("sk_test_secret");
		expect(decrypt(encryptedValue(content, "SECRET_KEY"), key)).toBe("sk_test_secret");
		expect(existsSync(join(directory, "config.unlocked.vars"))).toBe(false);
	});

	it("updates a locked secret in place with an injected key loader", async () => {
		await mutateVarsFile(
			file,
			{ kind: "set", target: "API_TOKEN", values: { default: "new-secret" } },
			{ getKey: getMasterKey },
		);

		const content = readFileSync(file, "utf8");
		expect(content).not.toContain("new-secret");
		expect(decrypt(encryptedValue(content, "API_TOKEN"), key)).toBe("new-secret");
	});

	it("refuses to write plaintext when an owner PIN cannot encrypt an unowned secret", async () => {
		const ownerKey = await deriveOwnerKey(key, "backend");
		const getOwnerKey = async () => ({ key: ownerKey, scope: { owner: "backend" } });
		const before = readFileSync(file, "utf8");

		await expect(
			mutateVarsFile(
				file,
				{
					kind: "add",
					target: "UNOWNED_SECRET",
					public: false,

					schema: "z.string()",
					values: { default: "must-not-leak" },
				},
				{ getKey: getOwnerKey },
			),
		).rejects.toThrow("cannot encrypt every changed secret");
		expect(readFileSync(file, "utf8")).toBe(before);
	});
	it("preserves an encrypted default when setting one environment", async () => {
		const before = readFileSync(file, "utf8");
		const encryptedDefault = encryptedValue(before, "API_TOKEN");

		await mutateVarsFile(
			file,
			{ kind: "set", target: "API_TOKEN", values: { dev: "dev-only-secret" } },
			{ getKey: getMasterKey },
		);

		const content = readFileSync(file, "utf8");
		expect(content).toContain(`API_TOKEN = ${encryptedDefault} {`);
		expect(content).not.toContain("dev-only-secret");
	});

	it("removes ciphertext without requiring a PIN", async () => {
		await mutateVarsFile(file, { kind: "remove", target: "API_TOKEN" });
		expect(readFileSync(file, "utf8")).not.toContain("API_TOKEN");
	});

	it("allows unrelated ciphertext removal beside an existing plaintext number", async () => {
		writeFileSync(file, `${readFileSync(file, "utf8")}\nRETRY_LIMIT : z.number() = 3\n`);

		await mutateVarsFile(file, { kind: "remove", target: "API_TOKEN" });

		const content = readFileSync(file, "utf8");
		expect(content).toContain("RETRY_LIMIT : z.number() = 3");
		expect(content).not.toContain("API_TOKEN");
	});

	it("encrypts a new secret beside an existing plaintext number", async () => {
		writeFileSync(file, `${readFileSync(file, "utf8")}\nRETRY_LIMIT : z.number() = 3\n`);

		await mutateVarsFile(
			file,
			{
				kind: "add",
				target: "NEW_SECRET",
				public: false,
				schema: "z.string()",
				values: { default: "new-secret" },
			},
			{ getKey: getMasterKey },
		);

		const content = readFileSync(file, "utf8");
		expect(content).toContain("RETRY_LIMIT : z.number() = 3");
		expect(content).not.toContain("new-secret");
	});

	it("atomically applies grouped public and secret declarations", async () => {
		await mutateVarsFile(
			file,
			{
				kind: "apply",
				patch: `group sentry {
  public DSN : z.string().url() = "https://example.test/1"
  AUTH_TOKEN = "sentry-secret"
}
`,
			},
			{ getKey: getMasterKey },
		);

		const content = readFileSync(file, "utf8");
		expect(content).toContain('public DSN : z.string().url() = "https://example.test/1"');
		expect(content).not.toContain("sentry-secret");
		expect(decrypt(encryptedValue(content, "AUTH_TOKEN"), key)).toBe("sentry-secret");
	});

	it("rejects duplicate qualified names in an apply patch", async () => {
		const before = readFileSync(file, "utf8");
		await expect(
			mutateVarsFile(
				file,
				{
					kind: "apply",
					patch: `group sentry {
  AUTH_TOKEN = "first"
  AUTH_TOKEN = "second"
}
`,
				},
				{ getKey: getMasterKey },
			),
		).rejects.toThrow("Duplicate declaration");
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it("rejects env declarations and conditional values in apply input", () => {
		expect(() =>
			mutateVarsSource('EXISTING = "value"\n', "config.vars", {
				kind: "apply",
				patch: 'env(qa)\nNEW_VALUE = "value"\n',
			}),
		).toThrow("accepts only variable and group declarations");
		expect(() =>
			mutateVarsSource('EXISTING = "value"\n', "config.vars", {
				kind: "apply",
				patch: 'NEW_VALUE {\n  when region = us => "value"\n  else => "fallback"\n}\n',
			}),
		).toThrow("without conditional values");
	});

	it("keeps top-level and grouped apply targets distinct", () => {
		const source = `group service {
  FOO = "grouped"
}
`;
		const result = mutateVarsSource(source, "config.vars", {
			kind: "apply",
			patch: 'public FOO = "top-level"\n',
		});

		expect(result.content).toContain('  FOO = "grouped"');
		expect(result.content).toContain('public FOO = "top-level"');
	});

	it("keeps grouped multi-line apply indentation idempotent", () => {
		const source = `env(dev, prod)
group service {
  TOKEN {
    dev = "old"
    prod = "old"
  }
}
`;
		const patch = `group service {
  TOKEN {
    dev = "new"
    prod = "new"
  }
}
`;
		const once = mutateVarsSource(source, "config.vars", { kind: "apply", patch }).content;
		const twice = mutateVarsSource(once, "config.vars", { kind: "apply", patch }).content;

		expect(twice).toBe(once);
	});

	it("preserves existing owner metadata when apply omits metadata", () => {
		const source = 'SECRET = "old" (owner = "backend")\n';
		const result = mutateVarsSource(source, "config.vars", {
			kind: "apply",
			patch: 'SECRET = "new"\n',
		});

		expect(result.content).toContain('SECRET = "new" (owner = "backend")');
	});

	it("preserves owner metadata across schema changes in apply", () => {
		const schemaPatch = mutateVarsSource(
			'AUTH_TOKEN = "old" (owner = "backend")\n',
			"config.vars",
			{ kind: "apply", patch: 'AUTH_TOKEN : z.string() = "new"\n' },
		).content;
		const plainPatch = mutateVarsSource(
			'AUTH_TOKEN : z.string() = "old" (owner = "backend")\n',
			"config.vars",
			{ kind: "apply", patch: 'AUTH_TOKEN = "new"\n' },
		).content;

		expect(schemaPatch).toContain('AUTH_TOKEN : z.string() = "new" (owner = "backend")');
		expect(plainPatch).toContain('AUTH_TOKEN = "new" (owner = "backend")');
		expect(plainPatch).not.toContain('() = "old"');
	});

	it("sets schema variables without treating schema calls as metadata", () => {
		const result = mutateVarsSource("FOO : z.number() = 1\n", "config.vars", {
			kind: "set",
			target: "FOO",
			values: { default: "2" },
		});

		expect(result.content).toBe("FOO : z.number() = 2\n");
	});

	it("preserves conditional variants and multiline env values when setting another env", () => {
		const source = `env(dev, staging, prod)
param region : enum(us, eu) = us
SECRET {
  dev = "old"
  staging = """
line one
line two
"""
  when region = us { prod = "us-secret" }
  when region = eu { prod = "eu-secret" }
}
`;
		const result = mutateVarsSource(source, "config.vars", {
			kind: "set",
			target: "SECRET",
			values: { dev: "new" },
		});

		expect(result.content).toContain('dev = "new"');
		expect(result.content).toContain('staging = """\nline one\nline two\n"""');
		expect(result.content).toContain('when region = us { prod = "us-secret" }');
		expect(result.content).toContain('when region = eu { prod = "eu-secret" }');
	});

	it("preserves a default containing braces when setting an environment", () => {
		const result = mutateVarsSource(
			'env(dev, prod)\nTOKEN = "prefix { suffix" {\n  prod = "old"\n}\n',
			"config.vars",
			{ kind: "set", target: "TOKEN", values: { prod: "new" } },
		);

		expect(result.content).toContain('TOKEN = "prefix { suffix" {');
		expect(result.content).toContain('prod = "new"');
	});

	it("mutates a non-string value in an unlocked file", async () => {
		const unlocked = join(directory, "standalone.unlocked.vars");
		writeFileSync(unlocked, "RETRY_LIMIT : z.number() = 1\n");

		await mutateVarsFile(unlocked, {
			kind: "set",
			target: "RETRY_LIMIT",
			values: { default: "2" },
		});

		expect(readFileSync(unlocked, "utf8")).toBe("RETRY_LIMIT : z.number() = 2\n");
	});

	it("strips one CRLF terminator from mutation value files", () => {
		const valueFile = join(directory, "value");
		writeFileSync(valueFile, "secret\r\n");

		expect(readValueFile(valueFile)).toBe("secret");
	});

	it("leaves the locked file unchanged when an apply patch is invalid", async () => {
		const before = readFileSync(file, "utf8");
		await expect(
			mutateVarsFile(file, { kind: "apply", patch: "BAD_SYNTAX !!!" }),
		).rejects.toThrow();
		expect(readFileSync(file, "utf8")).toBe(before);
	});
});
