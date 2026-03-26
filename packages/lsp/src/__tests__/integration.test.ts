import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type CompletionContext, computeCompletions } from "../completion.js";
import { computeDiagnostics } from "../diagnostics.js";
import { type HoverContext, computeHover } from "../hover.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("integration", () => {
	describe("simple.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "simple.vars"), "utf-8");
		const uri = "file:///project/app.vars";

		it("produces zero errors for a valid v2 file", () => {
			const diags = computeDiagnostics(text, uri);
			const errors = diags.filter((d) => d.severity === 1);
			expect(errors).toHaveLength(0);
		});

		it("provides hover for DATABASE_URL", () => {
			const lines = text.split("\n");
			const line = lines.findIndex((l) => l.startsWith("DATABASE_URL"));
			expect(line).toBeGreaterThanOrEqual(0);
			const result = computeHover({ text, line, character: 5, uri });
			expect(result).not.toBeNull();
			expect(result?.contents).toContain("DATABASE_URL");
		});

		it("provides hover for public APP_NAME showing public visibility", () => {
			const lines = text.split("\n");
			const line = lines.findIndex((l) => l.startsWith("public APP_NAME"));
			expect(line).toBeGreaterThanOrEqual(0);
			const result = computeHover({ text, line, character: 10, uri });
			expect(result).not.toBeNull();
			expect(result?.contents).toContain("APP_NAME");
		});

		it("provides Zod method completions after z.string().", () => {
			const modifiedText = text.replace("z.string().url()", "z.string().");
			const line = modifiedText.split("\n").findIndex((l) => l.includes("z.string()."));
			if (line === -1) throw new Error("fixture issue");
			const lineText = modifiedText.split("\n")[line] ?? "";
			const items = computeCompletions({
				text: modifiedText,
				line,
				character: lineText.indexOf("z.string().") + "z.string().".length,
				uri,
			});
			expect(items.length).toBeGreaterThan(0);
		});
	});

	describe("metadata.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "metadata.vars"), "utf-8");
		const uri = "file:///project/.vars";

		it("shows deprecation warning for API_KEY", () => {
			const diags = computeDiagnostics(text, uri);
			const deprecated = diags.filter((d) => d.message.includes("deprecated"));
			expect(deprecated.length).toBeGreaterThan(0);
		});

		it("shows expiry warning for API_KEY (expires in past)", () => {
			const diags = computeDiagnostics(text, uri);
			const expired = diags.filter((d) => d.message.includes("expired"));
			expect(expired.length).toBeGreaterThan(0);
		});

		it("includes metadata description in hover for API_KEY", () => {
			const lines = text.split("\n");
			const line = lines.findIndex((l) => l.startsWith("API_KEY"));
			expect(line).toBeGreaterThanOrEqual(0);
			const result = computeHover({ text, line, character: 3, uri });
			expect(result).not.toBeNull();
			expect(result?.contents).toContain("Primary API key");
		});
	});
});
