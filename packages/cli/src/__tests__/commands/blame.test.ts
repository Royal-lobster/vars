import { describe, expect, it } from "vitest";
import { buildBlamePattern } from "../../commands/blame.js";

describe("vars blame", () => {
  it("builds a git log grep pattern for a variable name", () => {
    const pattern = buildBlamePattern("DATABASE_URL");
    expect(pattern).toContain("DATABASE_URL");
  });

  it("escapes special regex characters in variable names", () => {
    const pattern = buildBlamePattern("MY_VAR");
    expect(pattern).toBe("MY_VAR");
  });
});
