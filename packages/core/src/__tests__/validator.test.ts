import { describe, expect, it } from "vitest";
import { evaluateSchema, validateValue } from "../validator.js";

describe("validator", () => {
	describe("evaluateSchema", () => {
		it("evaluates z.string()", () => {
			const schema = evaluateSchema("z.string()");
			expect(schema.safeParse("hello").success).toBe(true);
			expect(schema.safeParse(123).success).toBe(false);
		});

		it("evaluates z.number().min(1).max(100)", () => {
			const schema = evaluateSchema("z.number().min(1).max(100)");
			expect(schema.safeParse(50).success).toBe(true);
			expect(schema.safeParse(0).success).toBe(false);
		});

		it("evaluates z.enum([...])", () => {
			const schema = evaluateSchema('z.enum(["debug", "info", "warn"])');
			expect(schema.safeParse("debug").success).toBe(true);
			expect(schema.safeParse("trace").success).toBe(false);
		});

		it("evaluates z.coerce.number()", () => {
			const schema = evaluateSchema("z.coerce.number()");
			expect(schema.safeParse("42").success).toBe(true);
			if (schema.safeParse("42").success) expect(schema.safeParse("42").data).toBe(42);
		});

		it("evaluates z.coerce.boolean() — string 'false' → false", () => {
			const schema = evaluateSchema("z.coerce.boolean()");
			const result = schema.safeParse("false");
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toBe(false);
		});

		it("evaluates z.coerce.boolean() — string 'true' → true", () => {
			const schema = evaluateSchema("z.coerce.boolean()");
			const result = schema.safeParse("true");
			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toBe(true);
		});

		it("evaluates z.string().url()", () => {
			const schema = evaluateSchema("z.string().url()");
			expect(schema.safeParse("https://example.com").success).toBe(true);
			expect(schema.safeParse("not-a-url").success).toBe(false);
		});

		it("evaluates z.string().optional()", () => {
			const schema = evaluateSchema("z.string().optional()");
			expect(schema.safeParse(undefined).success).toBe(true);
			expect(schema.safeParse("hello").success).toBe(true);
		});

		it("rejects dangerous schemas — process", () => {
			expect(() => evaluateSchema("process.exit(1)")).toThrow();
		});

		it("rejects dangerous schemas — require", () => {
			expect(() => evaluateSchema("require('fs')")).toThrow();
		});

		it("rejects schemas not starting with z.", () => {
			expect(() => evaluateSchema("String('hello')")).toThrow();
		});

		it("rejects bracket notation (bypass attempt)", () => {
			expect(() => evaluateSchema('z.string()["constructor"]')).toThrow(/bracket/i);
		});

		it("rejects unknown methods", () => {
			expect(() => evaluateSchema("z.strng()")).toThrow(/unknown.*method/i);
		});

		it("allows known Zod methods", () => {
			expect(() => evaluateSchema("z.string().min(1).max(100).url()")).not.toThrow();
			expect(() => evaluateSchema("z.coerce.number().int().positive()")).not.toThrow();
			expect(() => evaluateSchema('z.enum(["a", "b"])')).not.toThrow();
		});
	});

	describe("validateValue", () => {
		it("validates a string value", () => {
			const result = validateValue("z.string().url()", "https://example.com");
			expect(result.success).toBe(true);
		});

		it("returns issues for invalid value", () => {
			const result = validateValue("z.string().url()", "not-a-url");
			expect(result.success).toBe(false);
			expect(result.issues!.length).toBeGreaterThan(0);
		});

		it("coerces string number for z.coerce.number()", () => {
			const result = validateValue("z.coerce.number().min(1)", "42");
			expect(result.success).toBe(true);
			if (result.success) expect(result.value).toBe(42);
		});
	});
});
