import { describe, expect, it } from "vitest";
import { generateCompletions } from "../../commands/completions.js";

describe("vars completions", () => {
  it("generates bash completions", () => {
    const result = generateCompletions("bash");
    expect(result).toContain("complete");
    expect(result).toContain("vars");
    expect(result).toContain("init");
    expect(result).toContain("unlock");
  });

  it("generates zsh completions", () => {
    const result = generateCompletions("zsh");
    expect(result).toContain("compdef");
    expect(result).toContain("vars");
  });

  it("generates fish completions", () => {
    const result = generateCompletions("fish");
    expect(result).toContain("complete");
    expect(result).toContain("vars");
  });

  it("throws for unknown shell", () => {
    expect(() => generateCompletions("powershell")).toThrow();
  });
});
