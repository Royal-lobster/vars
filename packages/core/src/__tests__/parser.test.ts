import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "../parser.js";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("parser", () => {
  describe("basic variable declarations", () => {
    it("parses variable names and schemas", () => {
      const result = parse(fixture("basic.vars"));
      const names = result.variables.map((v) => v.name);
      expect(names).toEqual([
        "DATABASE_URL",
        "DATABASE_POOL",
        "PORT",
        "LOG_LEVEL",
        "DEBUG",
        "ANALYTICS_ID",
      ]);
    });

    it("parses Zod schema expressions", () => {
      const result = parse(fixture("basic.vars"));
      const db = result.variables.find((v) => v.name === "DATABASE_URL");
      expect(db?.schema).toBe('z.string().url().startsWith("postgres://")');
    });

    it("captures line numbers", () => {
      const result = parse(fixture("basic.vars"));
      expect(result.variables[0].line).toBeGreaterThan(0);
    });
  });

  describe("environment values", () => {
    it("parses @env = value assignments", () => {
      const result = parse(fixture("basic.vars"));
      const db = result.variables.find((v) => v.name === "DATABASE_URL")!;
      expect(db.values).toHaveLength(3);
      expect(db.values[0]).toMatchObject({ env: "dev", value: "postgres://localhost:5432/myapp_dev" });
      expect(db.values[1]).toMatchObject({ env: "staging", value: "postgres://staging.db:5432/myapp" });
      expect(db.values[2]).toMatchObject({ env: "prod", value: "postgres://prod.db:5432/myapp" });
    });

    it("parses @default values", () => {
      const result = parse(fixture("basic.vars"));
      const pool = result.variables.find((v) => v.name === "DATABASE_POOL")!;
      expect(pool.values).toContainEqual(expect.objectContaining({ env: "default", value: "10" }));
    });

    it("parses optional variables", () => {
      const result = parse(fixture("basic.vars"));
      const analytics = result.variables.find((v) => v.name === "ANALYTICS_ID")!;
      expect(analytics.schema).toContain(".optional()");
      expect(analytics.values).toHaveLength(1);
    });
  });

  describe("comments", () => {
    it("ignores comment lines", () => {
      const result = parse(fixture("basic.vars"));
      // Comments should not appear as variables
      expect(result.variables.every((v) => !v.name.startsWith("#"))).toBe(true);
    });

    it("ignores empty lines", () => {
      const result = parse("# comment\n\nPORT  z.number()\n  @default = 3000\n");
      expect(result.variables).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("throws ParseError for invalid variable name", () => {
      expect(() => parse("lowercase  z.string()\n  @default = x\n")).toThrow("UPPER_SNAKE_CASE");
    });

    it("throws ParseError for missing schema", () => {
      expect(() => parse("PORT\n  @default = 3000\n")).toThrow();
    });

    it("throws ParseError for orphan env value (no parent variable)", () => {
      expect(() => parse("  @dev = value\n")).toThrow();
    });
  });
});
