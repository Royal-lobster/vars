import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../codegen.js";
import { parse } from "../parser.js";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("codegen", () => {
  it("imports zod and inlines Redacted class (no @vars/core import)", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain('import { z } from "zod"');
    expect(output).not.toContain('import { Redacted } from "@vars/core"');
    expect(output).not.toContain("@vars/core");
    expect(output).toContain("class Redacted<T>");
    expect(output).toContain("unwrap(): T");
    expect(output).toContain('Symbol.for("nodejs.util.inspect.custom")');
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

  it("does not wrap enum types in Redacted", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    // Enum type should be a bare literal union, not Redacted
    expect(output).toContain('"debug" | "info" | "warn" | "error"');
    expect(output).not.toContain("Redacted<\"debug\"");
  });

  it("marks optional fields with ?", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("ANALYTICS_ID?: Redacted<string>");
  });

  it("guards optional string fields against undefined", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("parsed.ANALYTICS_ID != null ? new Redacted(parsed.ANALYTICS_ID) : undefined");
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
    expect(output).toContain("export const vars: Var = parseVars(process.env)");
  });

  it("generates clientEnv using clientSchema.parse for PUBLIC_ vars", () => {
    const parsed = parse(
      [
        "SECRET_KEY  z.string()",
        "  @default = shhh",
        "",
        "NEXT_PUBLIC_API_URL  z.string().url()",
        "  @default = https://api.example.com",
      ].join("\n"),
    );
    const output = generateTypes(parsed);

    // Should use clientSchema.parse, not schema.parse for client env
    expect(output).toContain("clientSchema.parse(input)");
    expect(output).toContain("export const clientVars: ClientVar = parseClientVar(process.env)");

    // Should NOT parse all vars for client env
    expect(output).not.toContain("clientVars: ClientVar = parseVars(");
  });
});
