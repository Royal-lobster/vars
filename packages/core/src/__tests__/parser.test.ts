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

  describe("metadata directives", () => {
    it("parses @description", () => {
      const result = parse(fixture("metadata.vars"));
      const apiKey = result.variables.find((v) => v.name === "API_KEY")!;
      expect(apiKey.metadata.description).toBe("Primary API key for external service");
    });

    it("parses @expires", () => {
      const result = parse(fixture("metadata.vars"));
      const apiKey = result.variables.find((v) => v.name === "API_KEY")!;
      expect(apiKey.metadata.expires).toBe("2026-09-01");
    });

    it("parses @owner", () => {
      const result = parse(fixture("metadata.vars"));
      const apiKey = result.variables.find((v) => v.name === "API_KEY")!;
      expect(apiKey.metadata.owner).toBe("backend-team");
    });

    it("parses @deprecated", () => {
      const result = parse(fixture("metadata.vars"));
      const legacy = result.variables.find((v) => v.name === "LEGACY_TOKEN")!;
      expect(legacy.metadata.deprecated).toBe("Use API_KEY instead");
    });
  });

  describe("string quoting", () => {
    it("strips double quotes from values", () => {
      const result = parse(fixture("metadata.vars"));
      const quoted = result.variables.find((v) => v.name === "QUOTED_VAR")!;
      expect(quoted.values.find((v) => v.env === "dev")?.value).toBe("value with spaces");
    });

    it("strips single quotes from values", () => {
      const result = parse(fixture("metadata.vars"));
      const quoted = result.variables.find((v) => v.name === "QUOTED_VAR")!;
      expect(quoted.values.find((v) => v.env === "staging")?.value).toBe("single quoted");
    });

    it("passes through unquoted values", () => {
      const result = parse(fixture("metadata.vars"));
      const quoted = result.variables.find((v) => v.name === "QUOTED_VAR")!;
      expect(quoted.values.find((v) => v.env === "prod")?.value).toBe("simple");
    });

    it("handles empty quoted strings", () => {
      const result = parse(fixture("metadata.vars"));
      const empty = result.variables.find((v) => v.name === "EMPTY_VAR")!;
      expect(empty.values.find((v) => v.env === "dev")?.value).toBe("");
    });
  });

  describe("encrypted values", () => {
    it("preserves encrypted value strings as-is", () => {
      const result = parse(fixture("metadata.vars"));
      const apiKey = result.variables.find((v) => v.name === "API_KEY")!;
      const prodVal = apiKey.values.find((v) => v.env === "prod");
      expect(prodVal?.value).toMatch(/^enc:v1:aes256gcm:/);
    });
  });

  describe("@extends directive", () => {
    it("parses @extends path", () => {
      const result = parse(fixture("refine.vars"));
      expect(result.extendsPath).toBe("../parent.vars");
    });

    it("returns null when no @extends", () => {
      const result = parse(fixture("basic.vars"));
      expect(result.extendsPath).toBeNull();
    });

    it("throws on multiple @extends", () => {
      expect(() =>
        parse("@extends a.vars\n@extends b.vars\n"),
      ).toThrow("Multiple @extends");
    });
  });

  describe("@refine directive", () => {
    it("parses @refine expressions", () => {
      const result = parse(fixture("refine.vars"));
      expect(result.refines).toHaveLength(2);
    });

    it("captures expression and message", () => {
      const result = parse(fixture("refine.vars"));
      expect(result.refines[0].expression).toContain("LOG_LEVEL");
      expect(result.refines[0].message).toBe("DEBUG must be true when LOG_LEVEL is debug");
    });

    it("captures line number", () => {
      const result = parse(fixture("refine.vars"));
      expect(result.refines[0].line).toBeGreaterThan(0);
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
