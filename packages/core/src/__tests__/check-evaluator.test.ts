import { describe, it, expect } from "vitest";
import { evaluateCheck } from "../check-evaluator.js";
import { parse } from "../parser.js";
import type { CheckPredicate } from "../types.js";

// Helper: parse a check expression from inline vars source
function parseCheckPredicate(expr: string): CheckPredicate {
  const source = `env(dev, prod)\ncheck "test" {\n  ${expr}\n}`;
  const result = parse(source);
  return result.ast.checks[0]!.predicates[0]!;
}

describe("check-evaluator", () => {
  const vars: Record<string, string | undefined> = {
    PORT: "3000",
    LOG_LEVEL: "debug",
    DEBUG: "true",
    STRIPE_KEY: "sk_example_abc",
    TLS_CERT: undefined,
    CORS: '["http://localhost"]',
  };

  function check(expr: string, env = "dev", params: Record<string, string> = {}): boolean {
    const pred = parseCheckPredicate(expr);
    return evaluateCheck(pred, vars, env, params);
  }

  it("evaluates string equality", () => {
    expect(check('LOG_LEVEL == "debug"')).toBe(true);
    expect(check('LOG_LEVEL == "info"')).toBe(false);
  });

  it("evaluates inequality", () => {
    expect(check('LOG_LEVEL != "info"')).toBe(true);
    expect(check('LOG_LEVEL != "debug"')).toBe(false);
  });

  it("evaluates numeric comparison", () => {
    expect(check("PORT >= 1024")).toBe(true);
    expect(check("PORT >= 9000")).toBe(false);
    expect(check("PORT > 2999")).toBe(true);
    expect(check("PORT < 4000")).toBe(true);
    expect(check("PORT <= 3000")).toBe(true);
  });

  it("evaluates implication (true => true = true)", () => {
    expect(check('LOG_LEVEL == "debug" => DEBUG == "true"')).toBe(true);
  });

  it("evaluates implication (false => anything = true)", () => {
    expect(check('LOG_LEVEL == "info" => DEBUG == "false"')).toBe(true);
  });

  it("evaluates implication (true => false = false)", () => {
    expect(check('LOG_LEVEL == "debug" => DEBUG == "false"')).toBe(false);
  });

  it("evaluates defined()", () => {
    expect(check("defined(PORT)")).toBe(true);
    expect(check("defined(TLS_CERT)")).toBe(false);
  });

  it("evaluates starts_with()", () => {
    expect(check('starts_with(STRIPE_KEY, "sk_example_")')).toBe(true);
    expect(check('starts_with(STRIPE_KEY, "sk_live_")')).toBe(false);
  });

  it("evaluates matches()", () => {
    expect(check('matches(PORT, "^[0-9]+$")')).toBe(true);
    expect(check('matches(PORT, "^[a-z]+$")')).toBe(false);
  });

  it("evaluates one_of()", () => {
    expect(check('one_of(LOG_LEVEL, ["debug", "info"])')).toBe(true);
    expect(check('one_of(LOG_LEVEL, ["warn", "error"])')).toBe(false);
  });

  it("evaluates length()", () => {
    expect(check("length(STRIPE_KEY) >= 5")).toBe(true);
    expect(check("length(STRIPE_KEY) >= 100")).toBe(false);
  });

  it("evaluates env special variable", () => {
    expect(check('env == "dev"', "dev")).toBe(true);
    expect(check('env == "prod"', "dev")).toBe(false);
    expect(check('env == "prod"', "prod")).toBe(true);
  });

  it("evaluates and", () => {
    expect(check("PORT >= 1024 and PORT <= 65535")).toBe(true);
    expect(check("PORT >= 1024 and PORT <= 2000")).toBe(false);
  });

  it("evaluates or", () => {
    expect(check('LOG_LEVEL == "debug" or LOG_LEVEL == "info"')).toBe(true);
    expect(check('LOG_LEVEL == "warn" or LOG_LEVEL == "error"')).toBe(false);
  });

  it("evaluates not", () => {
    expect(check('not LOG_LEVEL == "info"')).toBe(true);
    expect(check('not LOG_LEVEL == "debug"')).toBe(false);
  });

  it("evaluates complex: env implication with function", () => {
    expect(check('env == "dev" => starts_with(STRIPE_KEY, "sk_example_")', "dev")).toBe(true);
    // In prod, implication antecedent is false → vacuously true
    expect(check('env == "dev" => starts_with(STRIPE_KEY, "sk_example_")', "prod")).toBe(true);
  });
});
