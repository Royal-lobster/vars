import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../codegen.js";
import { parse } from "../parser.js";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("codegen", () => {
  it("generates zero-dependency TypeScript", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).not.toContain("import");
    expect(output).toContain("process.env");
  });

  it("generates typed accessors from process.env", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain('read("DATABASE_URL")');
    expect(output).toContain('toNumber("PORT")');
    expect(output).toContain('toBoolean("DEBUG")');
  });

  it("generates Env type with correct types", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("DATABASE_URL: string");
    expect(output).toContain("PORT: number");
    expect(output).toContain("DEBUG: boolean");
  });

  it("marks optional fields with ?", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("ANALYTICS_ID?: string");
  });

  it("includes auto-generated header comment", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("auto-generated");
    expect(output).toContain("do not edit");
  });
});
