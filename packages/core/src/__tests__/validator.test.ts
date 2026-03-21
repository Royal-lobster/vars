import { describe, expect, it } from "vitest";
import { evaluateSchema, validateValue } from "../validator.js";

describe("validator", () => {
  describe("evaluateSchema", () => {
    it("evaluates z.string()", () => {
      const schema = evaluateSchema("z.string()");
      expect(schema.parse("hello")).toBe("hello");
    });

    it("evaluates z.coerce.number()", () => {
      const schema = evaluateSchema("z.coerce.number()");
      expect(schema.parse("42")).toBe(42);
    });

    it("evaluates z.coerce.boolean()", () => {
      const schema = evaluateSchema("z.coerce.boolean()");
      expect(schema.parse("true")).toBe(true);
    });

    it("evaluates z.string().url()", () => {
      const schema = evaluateSchema("z.string().url()");
      expect(schema.parse("https://example.com")).toBe("https://example.com");
      expect(() => schema.parse("not-a-url")).toThrow();
    });

    it("evaluates z.enum()", () => {
      const schema = evaluateSchema('z.enum(["a", "b", "c"])');
      expect(schema.parse("a")).toBe("a");
      expect(() => schema.parse("d")).toThrow();
    });

    it("evaluates z.string().min().max()", () => {
      const schema = evaluateSchema("z.string().min(2).max(5)");
      expect(schema.parse("abc")).toBe("abc");
      expect(() => schema.parse("a")).toThrow();
    });

    it("evaluates z.string().optional()", () => {
      const schema = evaluateSchema("z.string().optional()");
      expect(schema.parse(undefined)).toBeUndefined();
    });

    it("evaluates z.coerce.number().int().min().max()", () => {
      const schema = evaluateSchema("z.coerce.number().int().min(1).max(100)");
      expect(schema.parse("50")).toBe(50);
      expect(() => schema.parse("0")).toThrow();
      expect(() => schema.parse("3.5")).toThrow();
    });

    it('evaluates z.string().startsWith()', () => {
      const schema = evaluateSchema('z.string().startsWith("postgres://")');
      expect(schema.parse("postgres://localhost")).toBe("postgres://localhost");
      expect(() => schema.parse("mysql://localhost")).toThrow();
    });

    it("throws on invalid schema expression", () => {
      expect(() => evaluateSchema("not.valid()")).toThrow();
    });

    it("throws on dangerous code", () => {
      expect(() => evaluateSchema("z.string(); process.exit(1)")).toThrow();
    });

    it("blocks .transform() callbacks", () => {
      expect(() => evaluateSchema('z.string().transform(() => "evil")')).toThrow("forbidden callback method");
    });

    it("blocks prototype chain exploitation via vm sandbox", () => {
      expect(() => evaluateSchema('z.string(); []["flat"]["constructor"]("return this")()')).toThrow();
    });

    it("times out on infinite loops", () => {
      expect(() => evaluateSchema("z.string(); while(true){}")).toThrow();
    });
  });

  describe("validateValue", () => {
    it("returns success for valid value", () => {
      const result = validateValue("z.string().url()", "https://example.com");
      expect(result.success).toBe(true);
    });

    it("returns failure with issues for invalid value", () => {
      const result = validateValue("z.string().url()", "not-a-url");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it("coerces string to number", () => {
      const result = validateValue("z.coerce.number()", "42");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });
  });
});
