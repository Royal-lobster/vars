import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyRefines, extractReferencedVars } from "../refine.js";
import type { Refine } from "../types.js";

describe("refine", () => {
  describe("extractReferencedVars", () => {
    it("extracts variable names from expression", () => {
      const vars = extractReferencedVars(
        '(env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true',
      );
      expect(vars).toEqual(["LOG_LEVEL", "DEBUG"]);
    });

    it("handles complex expressions", () => {
      const vars = extractReferencedVars(
        "(env) => env.EMAIL_PROVIDER !== \"smtp\" || (!!env.SMTP_HOST && !!env.SMTP_PORT)",
      );
      expect(vars).toEqual(["EMAIL_PROVIDER", "SMTP_HOST", "SMTP_PORT"]);
    });

    it("deduplicates", () => {
      const vars = extractReferencedVars("(env) => env.FOO && env.FOO");
      expect(vars).toEqual(["FOO"]);
    });
  });

  describe("applyRefines", () => {
    it("applies refinement to z.object that passes", () => {
      const baseSchema = z.object({
        LOG_LEVEL: z.string(),
        DEBUG: z.boolean(),
      });

      const refines: Refine[] = [
        {
          expression: '(env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true',
          message: "DEBUG must be true when LOG_LEVEL is debug",
          line: 1,
        },
      ];

      const refined = applyRefines(baseSchema, refines);
      // This should pass: LOG_LEVEL is info, no constraint
      expect(refined.parse({ LOG_LEVEL: "info", DEBUG: false })).toBeTruthy();
      // This should pass: LOG_LEVEL is debug AND DEBUG is true
      expect(refined.parse({ LOG_LEVEL: "debug", DEBUG: true })).toBeTruthy();
    });

    it("applies refinement that fails", () => {
      const baseSchema = z.object({
        LOG_LEVEL: z.string(),
        DEBUG: z.boolean(),
      });

      const refines: Refine[] = [
        {
          expression: '(env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true',
          message: "DEBUG must be true when LOG_LEVEL is debug",
          line: 1,
        },
      ];

      const refined = applyRefines(baseSchema, refines);
      const result = refined.safeParse({ LOG_LEVEL: "debug", DEBUG: false });
      expect(result.success).toBe(false);
    });

    it("applies multiple refinements", () => {
      const baseSchema = z.object({
        A: z.number(),
        B: z.number(),
      });

      const refines: Refine[] = [
        { expression: "(env) => env.A > 0", message: "A must be positive", line: 1 },
        { expression: "(env) => env.B > env.A", message: "B must be greater than A", line: 2 },
      ];

      const refined = applyRefines(baseSchema, refines);
      expect(refined.parse({ A: 1, B: 2 })).toBeTruthy();
      expect(refined.safeParse({ A: -1, B: 2 }).success).toBe(false);
      expect(refined.safeParse({ A: 5, B: 3 }).success).toBe(false);
    });

    it("blocks global access in refine expressions", () => {
      const baseSchema = z.object({ A: z.number() });
      const refines: Refine[] = [{
        expression: '(env) => { const g = []["flat"]["constructor"]("return this")(); return typeof g.process !== "undefined" }',
        message: "exploit",
        line: 1,
      }];
      const refined = applyRefines(baseSchema, refines);
      // The sandbox prevents access to real globals — process should be undefined
      // so the refine returns false and validation fails
      const result = refined.safeParse({ A: 1 });
      expect(result.success).toBe(false);
    });
  });
});
