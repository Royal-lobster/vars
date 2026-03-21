import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTypes } from "../codegen.js";
import { parse } from "../parser.js";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("codegen", () => {
  it("generates valid TypeScript", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("import { loadEnvx");
    expect(output).not.toContain("import { z }");
  });

  it("generates loadEnvx call with type cast", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("as unknown as Env");
    expect(output).not.toContain("schema,");
  });

  it("generates Env type with Redacted<string> for strings", () => {
    const parsed = parse(fixture("basic.vars"));
    const output = generateTypes(parsed);
    expect(output).toContain("DATABASE_URL: Redacted<string>");
    expect(output).toContain("PORT: number");
    expect(output).toContain("DEBUG: boolean");
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
});
