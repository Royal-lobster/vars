import { describe, it, expect } from "vitest";
import { toUnlockedPath, toLockedPath, isUnlockedPath, toCanonicalPath } from "../unlocked-path.js";

describe("unlocked-path", () => {
  it("toUnlockedPath converts .vars to .unlocked.vars", () => {
    expect(toUnlockedPath("/project/config.vars")).toBe("/project/config.unlocked.vars");
    expect(toUnlockedPath("vars.vars")).toBe("vars.unlocked.vars");
  });

  it("toLockedPath converts .unlocked.vars to .vars", () => {
    expect(toLockedPath("/project/config.unlocked.vars")).toBe("/project/config.vars");
  });

  it("isUnlockedPath detects unlocked paths", () => {
    expect(isUnlockedPath("config.unlocked.vars")).toBe(true);
    expect(isUnlockedPath("config.vars")).toBe(false);
  });

  it("toCanonicalPath normalizes both variants", () => {
    expect(toCanonicalPath("config.unlocked.vars")).toBe("config.vars");
    expect(toCanonicalPath("config.vars")).toBe("config.vars");
  });
});
