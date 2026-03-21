import { describe, expect, it } from "vitest";
import { buildHistoryCommand } from "../../commands/history.js";

describe("vars history", () => {
  it("builds a git log command for a variable", () => {
    const cmd = buildHistoryCommand("API_KEY", ".vars");
    expect(cmd).toContain("git");
    expect(cmd).toContain("log");
    expect(cmd).toContain("API_KEY");
    expect(cmd).toContain(".vars");
  });
});
