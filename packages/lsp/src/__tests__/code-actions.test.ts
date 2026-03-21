import { describe, expect, it } from "vitest";
import { computeCodeActions, CodeActionContext } from "../code-actions.js";

describe("code-actions", () => {
  describe("add missing environments", () => {
    it("suggests adding missing envs when variable only has @dev", () => {
      const text = [
        "PORT  z.coerce.number()",
        "  @dev = 3000",
        "",
        "HOST  z.string()",
        "  @dev     = localhost",
        "  @staging = staging.example.com",
        "  @prod    = prod.example.com",
      ].join("\n");
      const actions = computeCodeActions({
        text,
        startLine: 0,
        endLine: 1,
        uri: "/test/.vars",
      });
      const addEnvActions = actions.filter((a) => a.kind === "quickfix.add-envs");
      expect(addEnvActions.length).toBeGreaterThan(0);
      // Should suggest adding staging and/or prod for PORT
      expect(addEnvActions[0].title).toContain("environment");
    });

    it("does not suggest when variable has all common envs", () => {
      const text = [
        "PORT  z.coerce.number()",
        "  @dev     = 3000",
        "  @staging = 4000",
        "  @prod    = 8080",
      ].join("\n");
      const actions = computeCodeActions({
        text,
        startLine: 0,
        endLine: 3,
        uri: "/test/.vars",
      });
      const addEnvActions = actions.filter((a) => a.kind === "quickfix.add-envs");
      expect(addEnvActions).toHaveLength(0);
    });
  });

  describe("mark as deprecated", () => {
    it("suggests adding @deprecated when variable has no deprecation", () => {
      const text = [
        "OLD_TOKEN  z.string()",
        "  @dev = abc123",
      ].join("\n");
      const actions = computeCodeActions({
        text,
        startLine: 0,
        endLine: 1,
        uri: "/test/.vars",
      });
      const deprecateActions = actions.filter(
        (a) => a.kind === "refactor.deprecated",
      );
      expect(deprecateActions.length).toBeGreaterThan(0);
    });

    it("does not suggest @deprecated when already present", () => {
      const text = [
        "OLD_TOKEN  z.string()",
        '  @deprecated "Use NEW_TOKEN instead"',
        "  @dev = abc123",
      ].join("\n");
      const actions = computeCodeActions({
        text,
        startLine: 0,
        endLine: 2,
        uri: "/test/.vars",
      });
      const deprecateActions = actions.filter(
        (a) => a.kind === "refactor.deprecated",
      );
      expect(deprecateActions).toHaveLength(0);
    });
  });
});
