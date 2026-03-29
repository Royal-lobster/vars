import { describe, expect, it } from "vitest";
import {
	createMasterKey,
	decryptMasterKey,
	encryptMasterKey,
	getKeyFromEnv,
	parseKeyFile,
	type KeyEntry,
} from "../key-manager.js";

describe("key-manager", () => {
	it("creates 32-byte key", async () => {
		const key = await createMasterKey();
		expect(key.length).toBe(32);
	});

	it("PIN encrypt/decrypt roundtrip", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "my-pin-1234");
		expect(encrypted).toMatch(/^pin:v1:aes256gcm:/);
		const decrypted = await decryptMasterKey(encrypted, "my-pin-1234");
		expect(decrypted).toEqual(key);
	});

	it("wrong PIN throws", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "correct");
		await expect(decryptMasterKey(encrypted, "wrong")).rejects.toThrow();
	});

	it("reads VARS_KEY from env", () => {
		const key = Buffer.from("a".repeat(32));
		process.env.VARS_KEY = key.toString("base64");
		expect(getKeyFromEnv()).toEqual(key);
		process.env.VARS_KEY = undefined;
	});
});

describe("scoped key format", () => {
	it("encryptMasterKey produces master-scoped line", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "my-pin");
		expect(encrypted).toMatch(/^pin:v1:aes256gcm:master:/);
	});

	it("encryptMasterKey with owner produces owner-scoped line", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "my-pin", "backend-team");
		expect(encrypted).toMatch(/^pin:v1:aes256gcm:owner=backend-team:/);
	});

	it("decryptMasterKey works with master-scoped line", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "test-pin");
		const decrypted = await decryptMasterKey(encrypted, "test-pin");
		expect(decrypted).toEqual(key);
	});

	it("decryptMasterKey works with owner-scoped line", async () => {
		const key = await createMasterKey();
		const encrypted = await encryptMasterKey(key, "owner-pin", "backend-team");
		const decrypted = await decryptMasterKey(encrypted, "owner-pin");
		expect(decrypted).toEqual(key);
	});
});

describe("parseKeyFile", () => {
	it("parses single master line", async () => {
		const key = await createMasterKey();
		const line = await encryptMasterKey(key, "pin");
		const entries = parseKeyFile(line);
		expect(entries).toHaveLength(1);
		expect(entries[0].scope).toBe("master");
	});

	it("parses multiple lines", async () => {
		const key = await createMasterKey();
		const masterLine = await encryptMasterKey(key, "master-pin");
		const ownerLine = await encryptMasterKey(key, "owner-pin", "backend-team");
		const entries = parseKeyFile(`${masterLine}\n${ownerLine}`);
		expect(entries).toHaveLength(2);
		expect(entries[0].scope).toBe("master");
		expect(entries[1].scope).toBe("owner:backend-team");
	});

	it("skips empty lines", async () => {
		const key = await createMasterKey();
		const line = await encryptMasterKey(key, "pin");
		const entries = parseKeyFile(`\n${line}\n\n`);
		expect(entries).toHaveLength(1);
	});

	it("parses legacy format (no scope) as master", () => {
		const legacy = "pin:v1:aes256gcm:SALT:IV:CT:TAG";
		const entries = parseKeyFile(legacy);
		expect(entries).toHaveLength(1);
		expect(entries[0].scope).toBe("master");
		expect(entries[0].raw).toBe(legacy);
	});
});
