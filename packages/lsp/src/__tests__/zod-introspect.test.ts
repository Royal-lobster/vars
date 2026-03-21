import { describe, expect, it } from "vitest";
import {
	evaluateSchema,
	getSchemaInfo,
	getZodMethods,
	getZodMethodsForType,
} from "../zod-introspect.js";

describe("zod-introspect", () => {
	describe("evaluateSchema", () => {
		it("evaluates a simple z.string() schema", () => {
			const result = evaluateSchema("z.string()");
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.schema).toBeDefined();
			}
		});

		it("evaluates z.string().url().startsWith('https://')", () => {
			const result = evaluateSchema("z.string().url().startsWith('https://')");
			expect(result.success).toBe(true);
		});

		it("evaluates z.coerce.number().int().min(1).max(100)", () => {
			const result = evaluateSchema("z.coerce.number().int().min(1).max(100)");
			expect(result.success).toBe(true);
		});

		it("evaluates z.enum(['debug', 'info', 'warn', 'error'])", () => {
			const result = evaluateSchema("z.enum(['debug', 'info', 'warn', 'error'])");
			expect(result.success).toBe(true);
		});

		it("evaluates z.coerce.boolean()", () => {
			const result = evaluateSchema("z.coerce.boolean()");
			expect(result.success).toBe(true);
		});

		it("evaluates z.string().optional()", () => {
			const result = evaluateSchema("z.string().optional()");
			expect(result.success).toBe(true);
		});

		it("returns error for invalid schema", () => {
			const result = evaluateSchema("z.notARealType()");
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeDefined();
			}
		});

		it("returns error for dangerous code", () => {
			const result = evaluateSchema("process.exit(1)");
			expect(result.success).toBe(false);
		});

		it("returns error for require/import attempts", () => {
			const result = evaluateSchema("require('fs')");
			expect(result.success).toBe(false);
		});
	});

	describe("getSchemaInfo", () => {
		it("extracts type name from z.string()", () => {
			const result = evaluateSchema("z.string()");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.typeName).toBe("ZodString");
			expect(info.checks).toEqual([]);
		});

		it("extracts checks from z.string().url().min(5)", () => {
			const result = evaluateSchema("z.string().url().min(5)");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.typeName).toBe("ZodString");
			expect(info.checks).toContainEqual(expect.objectContaining({ kind: "url" }));
			expect(info.checks).toContainEqual(expect.objectContaining({ kind: "min", value: 5 }));
		});

		it("extracts type name from z.coerce.number()", () => {
			const result = evaluateSchema("z.coerce.number()");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.typeName).toBe("ZodNumber");
			expect(info.isCoerced).toBe(true);
		});

		it("extracts enum values from z.enum()", () => {
			const result = evaluateSchema("z.enum(['a', 'b', 'c'])");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.typeName).toBe("ZodEnum");
			expect(info.enumValues).toEqual(["a", "b", "c"]);
		});

		it("detects optional from z.string().optional()", () => {
			const result = evaluateSchema("z.string().optional()");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.isOptional).toBe(true);
		});

		it("detects default value from z.string().default('hello')", () => {
			const result = evaluateSchema("z.string().default('hello')");
			if (!result.success) throw new Error("schema eval failed");
			const info = getSchemaInfo(result.schema);
			expect(info.hasDefault).toBe(true);
		});
	});

	describe("getZodMethods", () => {
		it("returns methods for ZodString prototype", () => {
			const methods = getZodMethods("ZodString");
			expect(methods).toContain("min");
			expect(methods).toContain("max");
			expect(methods).toContain("email");
			expect(methods).toContain("url");
			expect(methods).toContain("uuid");
			expect(methods).toContain("regex");
			expect(methods).toContain("startsWith");
			expect(methods).toContain("endsWith");
			expect(methods).toContain("optional");
			expect(methods).toContain("default");
		});

		it("returns methods for ZodNumber prototype", () => {
			const methods = getZodMethods("ZodNumber");
			expect(methods).toContain("min");
			expect(methods).toContain("max");
			expect(methods).toContain("int");
			expect(methods).toContain("positive");
			expect(methods).toContain("negative");
			expect(methods).toContain("optional");
		});

		it("returns empty array for unknown type", () => {
			const methods = getZodMethods("ZodFakeType");
			expect(methods).toEqual([]);
		});
	});

	describe("getZodMethodsForType", () => {
		it("discovers methods from a live schema instance", () => {
			const result = evaluateSchema("z.string()");
			if (!result.success) throw new Error("schema eval failed");
			const methods = getZodMethodsForType(result.schema);
			expect(methods).toContain("min");
			expect(methods).toContain("max");
			expect(methods).toContain("email");
			expect(methods).toContain("url");
		});

		it("excludes internal/inherited methods", () => {
			const result = evaluateSchema("z.string()");
			if (!result.success) throw new Error("schema eval failed");
			const methods = getZodMethodsForType(result.schema);
			expect(methods).not.toContain("constructor");
			expect(methods).not.toContain("_parse");
			expect(methods).not.toContain("_def");
		});
	});
});
