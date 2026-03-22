import { describe, expect, it } from "vitest";
import { HoverContext, computeHover } from "../hover.js";

describe("hover", () => {
	it("shows type info for a simple z.string() variable", () => {
		const text = ["DATABASE_URL  z.string().url()", "  @dev = postgres://localhost/db"].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 5, // inside "DATABASE_URL"
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("ZodString");
		expect(result?.contents).toContain("url");
	});

	it("shows coercion info for z.coerce.number()", () => {
		const text = ["PORT  z.coerce.number().int().min(1024).max(65535)", "  @default = 3000"].join(
			"\n",
		);
		const result = computeHover({
			text,
			line: 0,
			character: 2, // inside "PORT"
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("ZodNumber");
		expect(result?.contents).toContain("coerced");
	});

	it("shows enum values for z.enum()", () => {
		const text = [
			'LOG_LEVEL  z.enum(["debug", "info", "warn", "error"])',
			"  @default = info",
		].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 5,
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("ZodEnum");
		expect(result?.contents).toContain("debug");
		expect(result?.contents).toContain("error");
	});

	it("shows metadata in hover", () => {
		const text = [
			"API_KEY  z.string().min(32)",
			'  @description "Primary API key"',
			"  @expires 2026-09-01",
			"  @owner backend-team",
			"  @dev = sk_example_abc",
		].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 3,
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("Primary API key");
		expect(result?.contents).toContain("2026-09-01");
		expect(result?.contents).toContain("backend-team");
	});

	it("shows deprecation warning in hover", () => {
		const text = [
			"OLD_TOKEN  z.string()",
			'  @deprecated "Use API_KEY instead"',
			"  @dev = abc",
		].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 5,
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("Deprecated");
		expect(result?.contents).toContain("Use API_KEY instead");
	});

	it("shows optional flag", () => {
		const text = ["ANALYTICS  z.string().optional()", "  @prod = UA-123"].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 5,
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("optional");
	});

	it("returns null for comment lines", () => {
		const text = "# This is a comment";
		const result = computeHover({
			text,
			line: 0,
			character: 5,
			uri: "/test/.vars",
		});
		expect(result).toBeNull();
	});

	it("shows schema info when hovering on the schema portion", () => {
		const text = ["DATABASE_URL  z.string().url()", "  @dev = postgres://localhost/db"].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 20, // inside "z.string().url()"
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("z.string().url()");
		expect(result?.contents).toContain("ZodString");
	});

	it("shows public status in hover", () => {
		const text = [
			"PORT  z.coerce.number()",
			"  @public",
			"  @default = 3000",
		].join("\n");
		const result = computeHover({
			text,
			line: 0,
			character: 2,
			uri: "/test/.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.contents).toContain("Public");
	});

	it("returns null for env value lines", () => {
		const text = ["PORT  z.coerce.number()", "  @dev = 3000"].join("\n");
		const result = computeHover({
			text,
			line: 1,
			character: 8,
			uri: "/test/.vars",
		});
		// Hovering on the value line, not the variable name — return null
		expect(result).toBeNull();
	});
});
