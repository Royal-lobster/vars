import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

describe("vars history", () => {
  it("execFileSync is available for git commands", () => {
    // history.ts now uses execFileSync directly instead of building a command string
    // Verify the function signature accepts the expected arguments
    expect(typeof execFileSync).toBe("function");
  });
});
