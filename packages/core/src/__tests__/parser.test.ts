import { describe, it, expect } from "vitest";
import { parse } from "../parser.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("parser", () => {
  describe("env declaration", () => {
    it("parses env list", () => {
      const result = parse(fixture("simple.vars"));
      expect(result.ast.envs).toEqual(["dev", "staging", "prod"]);
    });

    it("rejects undeclared env names in env blocks", () => {
      const result = parse(
        'env(dev, prod)\nX : z.string() {\n  staging = "oops"\n}',
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("variable declarations", () => {
    it("parses public variable with inferred schema", () => {
      const result = parse(fixture("simple.vars"));
      const appName = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "APP_NAME",
      );
      expect(appName).toBeDefined();
      expect(appName!.kind).toBe("variable");
      if (appName!.kind === "variable") {
        expect(appName!.public).toBe(true);
        expect(appName!.schema).toBeNull();
      }
    });

    it("parses variable with explicit schema and default", () => {
      const result = parse(fixture("simple.vars"));
      const port = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "PORT",
      );
      expect(port).toBeDefined();
      if (port?.kind === "variable") {
        expect(port.public).toBe(true);
        expect(port.schema).toBe("z.number().int().min(1).max(65535)");
        expect(port.value?.kind).toBe("literal");
        if (port.value?.kind === "literal") expect(port.value.value).toBe(3000);
      }
    });

    it("parses env block with encrypted values", () => {
      const result = parse(fixture("simple.vars"));
      const dbUrl = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "DATABASE_URL",
      );
      expect(dbUrl).toBeDefined();
      if (dbUrl?.kind === "variable" && dbUrl.value?.kind === "env_block") {
        expect(dbUrl.value.entries).toHaveLength(3);
        expect(dbUrl.value.entries[2]!.value.kind).toBe("encrypted");
      }
    });

    it("parses variable with default AND env overrides", () => {
      const result = parse(fixture("simple.vars"));
      const logLevel = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "LOG_LEVEL",
      );
      expect(logLevel).toBeDefined();
      if (logLevel?.kind === "variable") {
        expect(logLevel.schema).toContain("z.enum");
        expect(logLevel.value).not.toBeNull();
        // Has default + env overrides → env_block with "*" default entry
        if (logLevel.value?.kind === "env_block") {
          const defaultEntry = logLevel.value.entries.find(
            (e) => e.env === "*",
          );
          expect(defaultEntry).toBeDefined();
          if (defaultEntry?.value.kind === "literal") {
            expect(defaultEntry.value.value).toBe("info");
          }
        }
      }
    });
  });

  describe("groups", () => {
    it("parses group with nested variables", () => {
      const result = parse(fixture("groups.vars"));
      expect(result.errors).toHaveLength(0);
      const group = result.ast.declarations.find((d) => d.kind === "group");
      expect(group).toBeDefined();
      if (group?.kind === "group") {
        expect(group.name).toBe("database");
        expect(group.declarations).toHaveLength(2);
        expect(group.declarations[0]!.name).toBe("HOST");
        expect(group.declarations[1]!.name).toBe("PORT");
        expect(group.declarations[1]!.public).toBe(true);
      }
    });
  });

  describe("metadata", () => {
    it("parses all metadata fields", () => {
      const result = parse(fixture("metadata.vars"));
      expect(result.errors).toHaveLength(0);
      const apiKey = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "API_KEY",
      );
      expect(apiKey).toBeDefined();
      if (apiKey?.kind === "variable") {
        expect(apiKey.metadata?.description).toBe("Primary API key");
        expect(apiKey.metadata?.owner).toBe("backend-team");
        expect(apiKey.metadata?.expires).toBe("2026-09-01");
        expect(apiKey.metadata?.tags).toEqual(["auth", "critical"]);
      }
    });
  });

  describe("interpolation", () => {
    it("detects interpolated values with refs", () => {
      const result = parse(fixture("interpolation.vars"));
      expect(result.errors).toHaveLength(0);
      const dbUrl = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "DB_URL",
      );
      expect(dbUrl).toBeDefined();
      if (dbUrl?.kind === "variable" && dbUrl.value?.kind === "interpolated") {
        expect(dbUrl.value.refs).toContain("DB_HOST");
        expect(dbUrl.value.refs).toContain("DB_PORT");
        expect(dbUrl.value.refs).toContain("DB_NAME");
        expect(dbUrl.value.template).toContain("${DB_HOST}");
      }
    });
  });

  describe("conditionals", () => {
    it("parses param declaration", () => {
      const result = parse(fixture("conditionals.vars"));
      expect(result.ast.params).toHaveLength(1);
      expect(result.ast.params[0]!.name).toBe("region");
      expect(result.ast.params[0]!.values).toEqual(["us", "eu"]);
      expect(result.ast.params[0]!.defaultValue).toBe("us");
    });

    it("parses pure conditional (when/else only)", () => {
      const result = parse(fixture("conditionals.vars"));
      const gdpr = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "GDPR_MODE",
      );
      expect(gdpr).toBeDefined();
      if (gdpr?.kind === "variable") {
        expect(gdpr.value?.kind).toBe("conditional");
        if (gdpr.value?.kind === "conditional") {
          expect(gdpr.value.whens).toHaveLength(1);
          expect(gdpr.value.whens[0]!.param).toBe("region");
          expect(gdpr.value.whens[0]!.value).toBe("eu");
          expect(gdpr.value.fallback).toBeDefined();
        }
      }
    });

    it("parses env block with when-qualified entries", () => {
      const result = parse(fixture("conditionals.vars"));
      const db = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "DATABASE_URL",
      );
      expect(db).toBeDefined();
      if (db?.kind === "variable") {
        expect(db.value?.kind).toBe("env_block");
      }
    });
  });

  describe("checks", () => {
    it("parses check blocks with descriptions", () => {
      const result = parse(fixture("checks.vars"));
      expect(result.errors).toHaveLength(0);
      expect(result.ast.checks).toHaveLength(2);
      expect(result.ast.checks[0]!.description).toBe(
        "No debug logging in prod",
      );
      expect(result.ast.checks[1]!.description).toBe(
        "Debug flag consistency",
      );
    });

    it("captures check body as predicate AST nodes", () => {
      const result = parse(fixture("checks.vars"));
      expect(result.ast.checks[0]!.predicates.length).toBeGreaterThan(0);

      // First check: env == "prod" => LOG_LEVEL != "debug"
      const pred0 = result.ast.checks[0]!.predicates[0]!;
      expect(pred0.kind).toBe("implication");
      if (pred0.kind === "implication") {
        expect(pred0.antecedent.kind).toBe("comparison");
        expect(pred0.consequent.kind).toBe("comparison");
      }

      // Second check: LOG_LEVEL == "debug" => DEBUG == true
      const pred1 = result.ast.checks[1]!.predicates[0]!;
      expect(pred1.kind).toBe("implication");
    });
  });

  describe("use imports", () => {
    it("parses use with pick filter", () => {
      const result = parse(fixture("use-child.vars"));
      expect(result.errors).toHaveLength(0);
      expect(result.ast.imports).toHaveLength(1);
      expect(result.ast.imports[0]!.path).toBe("./use-parent.vars");
      expect(result.ast.imports[0]!.filter?.kind).toBe("pick");
      expect(result.ast.imports[0]!.filter?.names).toEqual(["SHARED_HOST"]);
    });

    it("parses use without filter", () => {
      const result = parse('env(dev)\nuse "./other.vars"');
      expect(result.errors).toHaveLength(0);
      expect(result.ast.imports[0]!.filter).toBeUndefined();
    });
  });

  describe("multiline strings", () => {
    it("parses triple-quoted values", () => {
      const result = parse(fixture("multiline.vars"));
      expect(result.errors).toHaveLength(0);
      const cert = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "TLS_CERT",
      );
      expect(cert).toBeDefined();
      if (cert?.kind === "variable" && cert.value?.kind === "env_block") {
        const prod = cert.value.entries.find((e) => e.env === "prod");
        expect(prod).toBeDefined();
        if (prod?.value.kind === "literal") {
          expect(String(prod.value.value)).toContain("BEGIN CERTIFICATE");
        }
      }
    });
  });

  describe("arrays", () => {
    it("parses array values in env blocks", () => {
      const result = parse(fixture("arrays-objects.vars"));
      expect(result.errors).toHaveLength(0);
      const cors = result.ast.declarations.find(
        (d) => d.kind === "variable" && d.name === "CORS",
      );
      expect(cors).toBeDefined();
      if (cors?.kind === "variable" && cors.value?.kind === "env_block") {
        const dev = cors.value.entries.find((e) => e.env === "dev");
        expect(dev).toBeDefined();
        if (dev?.value.kind === "literal") {
          expect(dev.value.value).toEqual(["http://localhost:3000"]);
        }
        const prod = cors.value.entries.find((e) => e.env === "prod");
        expect(prod).toBeDefined();
        if (prod?.value.kind === "literal") {
          expect(prod.value.value).toEqual([
            "https://app.example.com",
            "https://admin.example.com",
          ]);
        }
      }
    });
  });

  describe("error recovery", () => {
    it("collects errors and continues parsing", () => {
      const result = parse(
        "$$$ invalid\nenv(dev)\npublic X = 1\n@@@ also bad",
      );
      expect(result.ast.envs).toEqual(["dev"]);
      expect(result.ast.declarations.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
