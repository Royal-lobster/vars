import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../codegen.js";
import { parse } from "../parser.js";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("codegen", () => {
  it("imports zod and @vars/core", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain('import { z } from "zod"');
    expect(output).toContain('import { Redacted } from "@vars/core"');
  });

  it("emits zod schema object with original schema expressions", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain('DATABASE_URL: z.string().url().startsWith("postgres://")');
    expect(output).toContain("PORT: z.coerce.number().int().min(1024).max(65535)");
    expect(output).toContain("DATABASE_POOL: z.coerce.number().int().min(1).max(100)");
  });

  it("replaces z.coerce.boolean() with envBoolean()", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("DEBUG: envBoolean()");
    expect(output).not.toContain("DEBUG: z.coerce.boolean()");
  });

  it("generates Env type with correct types", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("DATABASE_URL: Redacted<string>");
    expect(output).toContain("PORT: number");
    expect(output).toContain("DEBUG: boolean");
  });

  it("generates enum literal union types", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain('"debug" | "info" | "warn" | "error"');
  });

  it("marks optional fields with ?", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("ANALYTICS_ID?: Redacted<string>");
  });

  it("includes auto-generated header comment", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("auto-generated");
    expect(output).toContain("do not edit");
  });

  it("parses env via schema.parse(process.env)", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("schema.parse(");
    expect(output).toContain("export const env: Env = parseEnv(process.env)");
  });
});
