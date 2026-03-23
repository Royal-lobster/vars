import { describe, it, expect } from "vitest";
import { buildHeaderComment } from "../commands/init.js";

describe("buildHeaderComment", () => {
  it("generates boilerplate comment with docs link", () => {
    const result = buildHeaderComment({
      source: "boilerplate",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    expect(result).toContain("Replace the example variables below with your own.");
    expect(result).toContain("`public` = plaintext (not encrypted). Remove it to encrypt a var.");
    expect(result).toContain("Docs: https://vars-docs.vercel.app/docs/file-format");
    expect(result.startsWith("#\n")).toBe(true);
    expect(result.endsWith("\n#")).toBe(true);
  });

  it("generates short-form for small migration (<= 5 vars)", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["NEXT_PUBLIC_API_URL"],
      totalVarCount: 3,
      detectedPrefixes: ["NEXT_PUBLIC_"],
    });

    expect(result).toContain("`public` = plaintext (not encrypted). Remove it to encrypt a var.");
    expect(result).toContain("Docs:");
    expect(result).not.toContain("Migrated from .env");
    expect(result).not.toContain("Variables with");
  });

  it("generates long-form for large migration (> 5 vars) with prefixes", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["NEXT_PUBLIC_A", "NEXT_PUBLIC_B", "VITE_C"],
      totalVarCount: 10,
      detectedPrefixes: ["NEXT_PUBLIC_", "VITE_"],
    });

    expect(result).toContain("Migrated from .env");
    expect(result).toContain("check that public/encrypted classification is correct");
    expect(result).toContain("Variables with NEXT_PUBLIC_, VITE_ prefixes were marked public.");
    expect(result).toContain("`public` vars are plaintext and will not be encrypted.");
    expect(result).toContain("remove the `public` keyword to enable encryption");
  });

  it("generates long-form for all-private migration (> 5 vars, no public)", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: [],
      totalVarCount: 8,
      detectedPrefixes: [],
    });

    expect(result).toContain("Migrated from .env");
    expect(result).toContain("All variables will be encrypted before commit.");
    expect(result).not.toContain("public");
  });

  it("generates empty-env fallback", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: [],
      totalVarCount: 0,
      detectedPrefixes: [],
    });

    expect(result).toContain("No variables found in .env");
    expect(result).toContain("add your own below");
    expect(result).toContain("`public` = plaintext (not encrypted).");
  });

  it("generates long-form naming manually-public vars when no prefix matches", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["MY_CUSTOM_VAR", "ANOTHER_VAR"],
      totalVarCount: 8,
      detectedPrefixes: [],
    });

    expect(result).toContain("MY_CUSTOM_VAR, ANOTHER_VAR");
    expect(result).toContain("plaintext and will not be encrypted");
  });

  it("truncates manually-public var names beyond 5", () => {
    const result = buildHeaderComment({
      source: "env",
      publicVarNames: ["A", "B", "C", "D", "E", "F", "G"],
      totalVarCount: 10,
      detectedPrefixes: [],
    });

    expect(result).toContain("A, B, C, D, E, and 2 more");
    expect(result).not.toContain("F");
    expect(result).not.toContain("G");
  });

  it("boundary: 5 vars uses short-form, 6 vars uses long-form", () => {
    const shortCtx = {
      source: "env" as const,
      publicVarNames: ["A"],
      totalVarCount: 5,
      detectedPrefixes: ["NEXT_PUBLIC_"],
    };
    const longCtx = { ...shortCtx, totalVarCount: 6 };

    expect(buildHeaderComment(shortCtx)).not.toContain("Migrated from .env");
    expect(buildHeaderComment(longCtx)).toContain("Migrated from .env");
  });
});
