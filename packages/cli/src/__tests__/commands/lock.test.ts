import { describe, expect, it, vi } from "vitest";
import { lockKey } from "../../commands/lock.js";

vi.mock("@vars/core", async () => {
  const actual = await vi.importActual("@vars/core");
  let stored: Buffer | null = Buffer.alloc(32);
  return {
    ...actual,
    clearKey: vi.fn(async () => {
      stored = null;
    }),
    retrieveKey: vi.fn(async () => stored),
  };
});

describe("vars lock", () => {
  it("clears key from keychain", async () => {
    const { clearKey } = await import("@vars/core");
    await lockKey();
    expect(clearKey).toHaveBeenCalled();
  });
});
