import { describe, expect, it } from "vitest";
import { type HoverContext, computeHover } from "../hover.js";

describe("hover", () => {
  it("shows variable name and schema for a simple variable", () => {
    const text = [
      "env(dev, prod)",
      'DATABASE_URL : z.string().url() = "postgres://localhost:5432/myapp"',
    ].join("\n");
    const result = computeHover({
      text,
      line: 1,
      character: 5,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("DATABASE_URL");
    expect(result?.contents).toContain("z.string().url()");
  });

  it("shows public visibility for public variables", () => {
    const text = [
      "env(dev, prod)",
      'public APP_NAME = "my-app"',
    ].join("\n");
    const result = computeHover({
      text,
      line: 1,
      character: 10,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("public");
  });

  it("shows secret visibility for non-public variables", () => {
    const text = [
      "env(dev, prod)",
      'API_KEY : z.string() = "secret"',
    ].join("\n");
    const result = computeHover({
      text,
      line: 1,
      character: 5,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("secret");
  });

  it("shows metadata in hover", () => {
    const text = [
      "env(dev, prod)",
      'API_KEY : z.string() = "key" (',
      '  description = "Primary API key"',
      '  owner = "backend-team"',
      "  expires = 2026-09-01",
      ")",
    ].join("\n");
    const result = computeHover({
      text,
      line: 1,
      character: 3,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("Primary API key");
    expect(result?.contents).toContain("backend-team");
    expect(result?.contents).toContain("2026-09-01");
  });

  it("shows deprecation warning in hover", () => {
    const text = [
      "env(dev, prod)",
      'OLD_TOKEN : z.string() = "abc" (',
      '  deprecated = "Use API_KEY instead"',
      ")",
    ].join("\n");
    const result = computeHover({
      text,
      line: 1,
      character: 5,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("Deprecated");
    expect(result?.contents).toContain("Use API_KEY instead");
  });

  it("returns null for lines without variable declarations", () => {
    const text = [
      "env(dev, prod)",
      'DATABASE_URL : z.string().url() = "postgres://localhost"',
    ].join("\n");
    const result = computeHover({
      text,
      line: 0, // env() declaration line — not a variable
      character: 3,
      uri: "file:///test/app.vars",
    });
    expect(result).toBeNull();
  });

  it("returns null for comment lines", () => {
    const text = "# This is a comment";
    const result = computeHover({
      text,
      line: 0,
      character: 5,
      uri: "file:///test/app.vars",
    });
    expect(result).toBeNull();
  });

  it("shows variable name for variable inside a group", () => {
    const text = [
      "env(dev, prod)",
      "group DB {",
      '  HOST : z.string() = "localhost"',
      "}",
    ].join("\n");
    const result = computeHover({
      text,
      line: 2,
      character: 4,
      uri: "file:///test/app.vars",
    });
    expect(result).not.toBeNull();
    expect(result?.contents).toContain("HOST");
  });
});
