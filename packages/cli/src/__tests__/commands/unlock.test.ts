import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMasterKey,
  encryptMasterKey,
} from "@vars/core";
import { unlockKey } from "../../commands/unlock.js";

// Mock keychain for tests (keytar may not be available)
vi.mock("@vars/core", async () => {
  const actual = await vi.importActual("@vars/core");
  let stored: Buffer | null = null;
  return {
    ...actual,
    storeKey: vi.fn(async (key: Buffer) => {
      stored = key;
    }),
    retrieveKey: vi.fn(async () => stored),
    clearKey: vi.fn(async () => {
      stored = null;
    }),
  };
});

describe("vars unlock", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-unlock-test-"));
  });

  it("decrypts master key with correct PIN and stores in keychain", async () => {
    const masterKey = await createMasterKey();
    const pin = "1234";
    const encoded = await encryptMasterKey(masterKey, pin);
    writeFileSync(join(tmpDir, ".vars.key"), encoded);

    const result = await unlockKey(join(tmpDir, ".vars.key"), pin);
    expect(result).toEqual(masterKey);
    const { storeKey } = await import("@vars/core");
    expect(storeKey).toHaveBeenCalled();
  });

  it("throws with wrong PIN", async () => {
    const masterKey = await createMasterKey();
    const encoded = await encryptMasterKey(masterKey, "1234");
    writeFileSync(join(tmpDir, ".vars.key"), encoded);

    await expect(unlockKey(join(tmpDir, ".vars.key"), "wrong")).rejects.toThrow();
  });
});
