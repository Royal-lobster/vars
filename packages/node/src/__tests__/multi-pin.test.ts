import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOwnerEncrypted, parseEncryptedToken } from "@dotvars/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, deriveOwnerKey, encryptDeterministic } from "../crypto.js";
import {
	createMasterKey,
	decryptMasterKey,
	encryptMasterKey,
	parseKeyFile,
} from "../key-manager.js";
import { hideFile, showFile } from "../show-hide.js";

describe("multi-pin integration", () => {
	let dir: string;
	let masterKey: Buffer;

	const varsContent = `env(dev, prod)

public APP_NAME = "my-app"

API_KEY : z.string() {
  dev = "master-api-key"
  prod = "master-api-key-prod"
}

DB_PASSWORD : z.string() {
  dev = "backend-db-pass"
  prod = "backend-db-pass-prod"
} (owner = "backend-team")

STRIPE_KEY : z.string() {
  dev = "sk_test_123"
} (owner = "backend-team")

GA_TOKEN : z.string() {
  dev = "ga-token-123"
} (owner = "frontend-team")`;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), "vars-multipin-"));
		masterKey = await createMasterKey();
	});

	afterEach(() => rmSync(dir, { recursive: true }));

	it("full workflow: master hide → owner show → owner hide → master show", async () => {
		const f = join(dir, "config.vars");
		writeFileSync(f, varsContent);

		// Step 1: Master hides everything
		await hideFile(f, masterKey, "master");
		const hidden = readFileSync(f, "utf8");

		// Public stays plain
		expect(hidden).toContain('"my-app"');
		// All secrets encrypted
		expect(hidden).not.toContain("master-api-key");
		expect(hidden).not.toContain("backend-db-pass");
		expect(hidden).not.toContain("sk_test_123");
		expect(hidden).not.toContain("ga-token-123");
		// Owner-tagged fields have owner in prefix
		expect(hidden).toContain("owner=backend-team:");
		expect(hidden).toContain("owner=frontend-team:");
		// Non-owner field has no owner tag
		const lines = hidden.split("\n");
		const apiKeyLine = lines.find((l) => l.includes("enc:v2:") && !l.includes("owner="));
		expect(apiKeyLine).toBeDefined();

		// Step 2: Backend team shows with their key
		const backendKey = await deriveOwnerKey(masterKey, "backend-team");
		const unlocked = await showFile(f, backendKey, { owner: "backend-team" });
		const backendView = readFileSync(unlocked, "utf8");

		// Backend secrets decrypted
		expect(backendView).toContain("backend-db-pass");
		expect(backendView).toContain("sk_test_123");
		// Master and frontend secrets still encrypted
		expect(backendView).not.toContain("master-api-key");
		expect(backendView).not.toContain("ga-token-123");

		// Step 3: Backend team hides
		await hideFile(unlocked, backendKey, { owner: "backend-team" });
		const reHidden = readFileSync(join(dir, "config.vars"), "utf8");

		// Everything encrypted again
		expect(reHidden).not.toContain("backend-db-pass");
		expect(reHidden).not.toContain("sk_test_123");

		// Step 4: Master shows everything
		const masterUnlocked = await showFile(join(dir, "config.vars"), masterKey, "master");
		const masterView = readFileSync(masterUnlocked, "utf8");

		// All secrets visible
		expect(masterView).toContain("master-api-key");
		expect(masterView).toContain("backend-db-pass");
		expect(masterView).toContain("sk_test_123");
		expect(masterView).toContain("ga-token-123");
		expect(masterView).toContain('"my-app"');
	});

	it("key file with multiple entries: correct PIN resolves correct scope", async () => {
		const backendKey = await deriveOwnerKey(masterKey, "backend-team");

		const masterLine = await encryptMasterKey(masterKey, "master-pin-123");
		const backendLine = await encryptMasterKey(backendKey, "backend-pin-456", "backend-team");
		const keyFileContent = `${masterLine}\n${backendLine}`;

		const entries = parseKeyFile(keyFileContent);
		expect(entries).toHaveLength(2);

		// Master PIN decrypts master entry
		const masterDecrypted = await decryptMasterKey(entries[0].raw, "master-pin-123");
		expect(masterDecrypted).toEqual(masterKey);

		// Backend PIN decrypts backend entry
		const backendDecrypted = await decryptMasterKey(entries[1].raw, "backend-pin-456");
		expect(backendDecrypted).toEqual(backendKey);

		// Cross-PIN fails
		await expect(decryptMasterKey(entries[0].raw, "backend-pin-456")).rejects.toThrow();
		await expect(decryptMasterKey(entries[1].raw, "master-pin-123")).rejects.toThrow();
	});

	it("deterministic: hide with master scope produces same ciphertext", async () => {
		const f = join(dir, "config.vars");
		writeFileSync(f, varsContent);

		await hideFile(f, masterKey, "master");
		const first = readFileSync(f, "utf8");

		const unlocked = await showFile(f, masterKey, "master");
		await hideFile(unlocked, masterKey, "master");
		const second = readFileSync(join(dir, "config.vars"), "utf8");

		expect(first).toBe(second);
	});
});
