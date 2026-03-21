import { describe, expect, it } from "vitest";
import { computeDefinition, DefinitionContext } from "../definition.js";

describe("definition", () => {
  it("resolves @extends path on the @extends line", () => {
    const text = [
      "@extends ./extends-parent.vars",
      "",
      "PORT  z.coerce.number()",
      "  @default = 3000",
    ].join("\n");
    const result = computeDefinition({
      text,
      line: 0,
      character: 15,
      uri: "file:///project/apps/web/.vars",
    });
    expect(result).not.toBeNull();
    expect(result!.targetUri).toContain("extends-parent.vars");
  });

  it("returns null for non-@extends lines", () => {
    const text = [
      "PORT  z.coerce.number()",
      "  @default = 3000",
    ].join("\n");
    const result = computeDefinition({
      text,
      line: 0,
      character: 5,
      uri: "file:///project/.vars",
    });
    expect(result).toBeNull();
  });

  it("returns null for comment lines", () => {
    const text = "# This is a comment";
    const result = computeDefinition({
      text,
      line: 0,
      character: 5,
      uri: "file:///project/.vars",
    });
    expect(result).toBeNull();
  });

  it("resolves relative @extends paths", () => {
    const text = "@extends ../../.vars";
    const result = computeDefinition({
      text,
      line: 0,
      character: 15,
      uri: "file:///project/apps/web/.vars",
    });
    expect(result).not.toBeNull();
    expect(result!.targetUri).toBe("file:///project/.vars");
  });

  it("highlights the path portion of the @extends line", () => {
    const text = "@extends ./parent.vars";
    const result = computeDefinition({
      text,
      line: 0,
      character: 15,
      uri: "file:///project/.vars",
    });
    expect(result).not.toBeNull();
    expect(result!.originRange.startChar).toBe("@extends ".length);
  });
});
