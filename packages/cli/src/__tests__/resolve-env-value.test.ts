import { encryptDeterministic } from "@dotvars/node";
import { describe, expect, it, vi } from "vitest";
import { resolveEnvValue } from "../utils/resolve-env-value.js";

describe("resolveEnvValue", () => {
	it("does not load a key for plaintext values", async () => {
		const loadKey = vi.fn(async () => ({ key: Buffer.alloc(32), scope: "master" as const }));

		await expect(resolveEnvValue("https://api.recalio.com", loadKey)).resolves.toBe(
			"https://api.recalio.com",
		);
		expect(loadKey).not.toHaveBeenCalled();
	});

	it("loads a key only when decrypting encrypted values", async () => {
		const key = Buffer.alloc(32, 1);
		const encrypted = encryptDeterministic("secret", key, "SECRET");
		const loadKey = vi.fn(async () => ({ key, scope: "master" as const }));

		await expect(resolveEnvValue(encrypted, loadKey)).resolves.toBe("secret");
		expect(loadKey).toHaveBeenCalledTimes(1);
	});

	it("decrypts owner secrets with a master key and enforces owner keys", async () => {
		const master = Buffer.alloc(32, 2);
		const { deriveOwnerKey } = await import("@dotvars/node");
		const ownerKey = await deriveOwnerKey(master, "backend");
		const encrypted = encryptDeterministic("secret", ownerKey, "SECRET", "backend");

		await expect(
			resolveEnvValue(encrypted, async () => ({ key: master, scope: "master" })),
		).resolves.toBe("secret");
		await expect(
			resolveEnvValue(encrypted, async () => ({ key: ownerKey, scope: { owner: "frontend" } })),
		).rejects.toThrow('Secret belongs to owner "backend"');
	});

	it("propagates key-loading errors for encrypted values", async () => {
		const key = Buffer.alloc(32, 1);
		const encrypted = encryptDeterministic("secret", key, "SECRET");
		const loadKey = vi.fn(async () => {
			throw new Error("Invalid PIN");
		});

		await expect(resolveEnvValue(encrypted, loadKey)).rejects.toThrow("Invalid PIN");
		expect(loadKey).toHaveBeenCalledTimes(1);
	});
});
