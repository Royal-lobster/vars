import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createMasterKey,
	decrypt,
	deriveOwnerKey,
	encryptMasterKey,
	encryptVarsContent,
} from "@dotvars/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mutateVarsFile } from "../utils/vars-source-mutation.js";

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
	let keyFile: string;
	let pinFile: string;
	let key: Buffer;

	beforeEach(async () => {
		directory = join(tmpdir(), `vars-locked-mutation-${Date.now()}-${Math.random()}`);
		mkdirSync(directory);
		file = join(directory, "config.vars");
		keyFile = join(directory, "project-envelope");
		pinFile = join(directory, "pin");
		key = await createMasterKey();
		writeFileSync(keyFile, `${await encryptMasterKey(key, "2468")}\n`);
		writeFileSync(pinFile, "2468\n", { mode: 0o600 });
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
			{ pinFile, keyFile },
		);

		const content = readFileSync(file, "utf8");
		expect(content).toContain("group stripe {");
		expect(content).toContain('public PUBLISHABLE_KEY = "pk_test_public"');
		expect(content).not.toContain("sk_test_secret");
		expect(decrypt(encryptedValue(content, "SECRET_KEY"), key)).toBe("sk_test_secret");
		expect(existsSync(join(directory, "config.unlocked.vars"))).toBe(false);
	});

	it("updates a locked secret in place and accepts an external key envelope", async () => {
		await mutateVarsFile(
			file,
			{ kind: "set", target: "API_TOKEN", values: { default: "new-secret" } },
			{ pinFile, keyFile },
		);

		const content = readFileSync(file, "utf8");
		expect(content).not.toContain("new-secret");
		expect(decrypt(encryptedValue(content, "API_TOKEN"), key)).toBe("new-secret");
	});

	it("refuses to write plaintext when an owner PIN cannot encrypt an unowned secret", async () => {
		const ownerKey = await deriveOwnerKey(key, "backend");
		writeFileSync(
			keyFile,
			`${readFileSync(keyFile, "utf8").trim()}\n${await encryptMasterKey(ownerKey, "owner-pin", "backend")}\n`,
		);
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
				{ pin: "owner-pin", keyFile },
			),
		).rejects.toThrow("cannot encrypt every changed secret");
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it("removes ciphertext without requiring a PIN", async () => {
		await mutateVarsFile(file, { kind: "remove", target: "API_TOKEN" });
		expect(readFileSync(file, "utf8")).not.toContain("API_TOKEN");
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
			{ pinFile, keyFile },
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
				{ pinFile, keyFile },
			),
		).rejects.toThrow("Duplicate declaration");
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it("leaves the locked file unchanged when an apply patch is invalid", async () => {
		const before = readFileSync(file, "utf8");
		await expect(
			mutateVarsFile(file, { kind: "apply", patch: "BAD_SYNTAX !!!" }, { pinFile, keyFile }),
		).rejects.toThrow();
		expect(readFileSync(file, "utf8")).toBe(before);
	});
});
