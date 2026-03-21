import { randomBytes } from "node:crypto";
import { describe, expect, it, afterEach } from "vitest";
import { clearKey, retrieveKey, storeKey } from "../keychain.js";

// Skip in CI — keychain not available
const describeKeychain = process.env.CI ? describe.skip : describe;

describeKeychain("keychain", () => {
  afterEach(async () => {
    await clearKey();
  });

  it("stores and retrieves a key", async () => {
    const key = randomBytes(32);
    await storeKey(key);
    const retrieved = await retrieveKey();
    expect(retrieved).toEqual(key);
  });

  it("returns null when no key stored", async () => {
    await clearKey();
    const retrieved = await retrieveKey();
    expect(retrieved).toBeNull();
  });

  it("clears stored key", async () => {
    const key = randomBytes(32);
    await storeKey(key);
    await clearKey();
    const retrieved = await retrieveKey();
    expect(retrieved).toBeNull();
  });
});
