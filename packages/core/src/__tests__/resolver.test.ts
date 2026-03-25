import { describe, expect, it } from "vitest";
import { parse } from "../parser.js";
import { resolveAll, resolveInterpolation, resolveValue } from "../resolver.js";
import type { VariableDecl } from "../types.js";

describe("resolver", () => {
	describe("resolveValue", () => {
		it("resolves literal default value", () => {
			const result = parse("env(dev, prod)\npublic PORT : z.number() = 3000");
			const portDecl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(portDecl, "dev", {})).toBe("3000");
			expect(resolveValue(portDecl, "prod", {})).toBe("3000");
		});

		it("resolves env-specific value", () => {
			const result = parse(
				'env(dev, prod)\nDB : z.string() {\n  dev = "localhost"\n  prod = "prod.db"\n}',
			);
			const dbDecl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(dbDecl, "dev", {})).toBe("localhost");
			expect(resolveValue(dbDecl, "prod", {})).toBe("prod.db");
		});

		it("returns undefined for missing env", () => {
			const result = parse(
				'env(dev, staging, prod)\nDB : z.string() {\n  dev = "localhost"\n  prod = "prod.db"\n}',
			);
			const dbDecl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(dbDecl, "staging", {})).toBeUndefined();
		});

		it("resolves pure conditional (when/else)", () => {
			const result = parse(
				"env(dev, prod)\nparam region : enum(us, eu) = us\npublic GDPR : z.boolean() {\n  when region = eu => true\n  else => false\n}",
			);
			const gdprDecl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(gdprDecl, "prod", { region: "eu" })).toBe("true");
			expect(resolveValue(gdprDecl, "prod", { region: "us" })).toBe("false");
		});

		it("resolves env block with when-qualified entries", () => {
			const src = `env(dev, prod)
param region : enum(us, eu) = us
DB : z.string() {
  dev = "localhost"
  when region = us { prod = "us.db" }
  when region = eu { prod = "eu.db" }
}`;
			const result = parse(src);
			const dbDecl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(dbDecl, "dev", { region: "us" })).toBe("localhost");
			expect(resolveValue(dbDecl, "prod", { region: "us" })).toBe("us.db");
			expect(resolveValue(dbDecl, "prod", { region: "eu" })).toBe("eu.db");
		});

		it("resolves encrypted value as raw string", () => {
			const result = parse(
				'env(dev, prod)\nS : z.string() {\n  dev = "plain"\n  prod = enc:v2:aes256gcm-det:a:b:c\n}',
			);
			const decl = result.ast.declarations[0] as VariableDecl;
			expect(resolveValue(decl, "prod", {})).toBe("enc:v2:aes256gcm-det:a:b:c");
		});
	});

	describe("resolveInterpolation", () => {
		it("replaces ${VAR} references", () => {
			const resolved = new Map([
				["HOST", "localhost"],
				["PORT", "5432"],
			]);
			expect(resolveInterpolation("postgres://${HOST}:${PORT}/db", resolved)).toBe(
				"postgres://localhost:5432/db",
			);
		});

		it("throws on unresolved reference", () => {
			const resolved = new Map<string, string>();
			expect(() => resolveInterpolation("${MISSING}", resolved)).toThrow();
		});

		it("handles escaped \\${", () => {
			const resolved = new Map([["X", "val"]]);
			expect(resolveInterpolation("literal \\${NOT_A_REF} and ${X}", resolved)).toBe(
				"literal ${NOT_A_REF} and val",
			);
		});
	});

	describe("resolveAll", () => {
		it("resolves all variables and flattens groups", () => {
			const src = `env(dev, prod)
public APP = "my-app"
group db {
  HOST : z.string() {
    dev = "localhost"
    prod = "prod.db"
  }
  public PORT : z.number() = 5432
}`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);

			const app = resolved.vars.find((v) => v.name === "APP");
			expect(app?.flatName).toBe("APP");
			expect(app?.value).toBe("my-app");
			expect(app?.public).toBe(true);

			const host = resolved.vars.find((v) => v.name === "HOST");
			expect(host?.flatName).toBe("DB_HOST");
			expect(host?.value).toBe("localhost");
			expect(host?.group).toBe("db");

			const port = resolved.vars.find((v) => v.name === "PORT");
			expect(port?.flatName).toBe("DB_PORT");
			expect(port?.value).toBe("5432");
			expect(port?.public).toBe(true);
		});

		it("resolves interpolated values after all vars are resolved", () => {
			const src = `env(dev, prod)
HOST : z.string() {
  dev = "localhost"
  prod = "prod.db"
}
PORT : z.number() = 5432
URL : z.string() = "postgres://\${HOST}:\${PORT}/mydb"`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);
			const url = resolved.vars.find((v) => v.name === "URL");
			expect(url?.value).toBe("postgres://localhost:5432/mydb");
		});

		it("resolves transitive interpolation (A → B → C)", () => {
			const src = `env(dev)
HOST = "localhost"
CONN = "host=\${HOST}"
URL = "jdbc:\${CONN}/db"`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);
			const url = resolved.vars.find((v) => v.name === "URL");
			expect(url?.value).toBe("jdbc:host=localhost/db");
		});

		it("does not stutter flatName when var name already has group prefix", () => {
			const src = `env(dev)
group rate_limit {
  RATE_LIMIT_RPM : z.coerce.number() = 100
  RATE_LIMIT_BURST : z.coerce.number() = 50
}`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);

			const rpm = resolved.vars.find((v) => v.name === "RATE_LIMIT_RPM");
			expect(rpm?.flatName).toBe("RATE_LIMIT_RPM");
			expect(rpm?.group).toBe("rate_limit");

			const burst = resolved.vars.find((v) => v.name === "RATE_LIMIT_BURST");
			expect(burst?.flatName).toBe("RATE_LIMIT_BURST");
			expect(burst?.group).toBe("rate_limit");
		});

		it("still prefixes flatName when var name does not have group prefix", () => {
			const src = `env(dev)
group db {
  HOST : z.string() = "localhost"
  PORT : z.number() = 5432
}`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);

			const host = resolved.vars.find((v) => v.name === "HOST");
			expect(host?.flatName).toBe("DB_HOST");

			const port = resolved.vars.find((v) => v.name === "PORT");
			expect(port?.flatName).toBe("DB_PORT");
		});

		it("deduplicates top-level vars that also exist in a group", () => {
			const src = `env(dev)
RATE_LIMIT_BURST : z.string() = "ghost"
group rate_limit {
  RATE_LIMIT_BURST : z.coerce.number() = 50
}`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);

			// Should only appear once — the grouped version
			const matches = resolved.vars.filter((v) => v.name === "RATE_LIMIT_BURST");
			expect(matches).toHaveLength(1);
			expect(matches[0]?.group).toBe("rate_limit");
			expect(matches[0]?.schema).toBe("z.coerce.number()");
			expect(matches[0]?.value).toBe("50");
		});

		it("does not emit duplicate vars when multiple top-level ghosts exist", () => {
			const src = `env(dev)
UPSTREAM_TIMEOUT_MS : z.string() = "ghost1"
UPSTREAM_TIMEOUT_MS : z.string() = "ghost2"
group upstream {
  UPSTREAM_TIMEOUT_MS : z.coerce.number() = 3000
  UPSTREAM_PRIMARY_URL : z.string() = "https://example.com"
}`;
			const result = parse(src);
			const resolved = resolveAll(
				result.ast.declarations,
				"dev",
				{},
				result.ast.envs,
				result.ast.params,
			);

			const timeoutMatches = resolved.vars.filter((v) => v.name === "UPSTREAM_TIMEOUT_MS");
			expect(timeoutMatches).toHaveLength(1);
			expect(timeoutMatches[0]?.group).toBe("upstream");

			const urlVar = resolved.vars.find((v) => v.name === "UPSTREAM_PRIMARY_URL");
			expect(urlVar?.flatName).toBe("UPSTREAM_PRIMARY_URL");
			expect(urlVar?.group).toBe("upstream");
		});
	});
});
