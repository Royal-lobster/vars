import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type CodeActionContext, computeCodeActions } from "../code-actions.js";
import { type CompletionContext, computeCompletions } from "../completion.js";
import { type DefinitionContext, computeDefinition } from "../definition.js";
import { computeDiagnostics } from "../diagnostics.js";
import { type HoverContext, computeHover } from "../hover.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("integration", () => {
	describe("basic.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "basic.vars"), "utf-8");
		const uri = "file:///project/.vars";

		it("produces zero errors for a valid file", () => {
			const diags = computeDiagnostics(text, uri);
			const errors = diags.filter((d) => d.severity === 1);
			expect(errors).toHaveLength(0);
		});

		it("provides hover for DATABASE_URL", () => {
			// Find the line with DATABASE_URL
			const lines = text.split("\n");
			const line = lines.findIndex((l) => l.startsWith("DATABASE_URL"));
			const result = computeHover({ text, line, character: 5, uri });
			expect(result).not.toBeNull();
		});

		it("provides Zod method completions in the schema area", () => {
			// Simulate typing after z.string().
			const modifiedText = text.replace(
				'z.string().url().startsWith("postgres://")',
				"z.string().",
			);
			const line = modifiedText.split("\n").findIndex((l) => l.includes("z.string()."));
			if (line === -1) throw new Error("fixture issue");
			const lineText = modifiedText.split("\n")[line];
			const items = computeCompletions({
				text: modifiedText,
				line,
				character: lineText.indexOf("z.string().") + "z.string().".length,
				uri,
			});
			expect(items.length).toBeGreaterThan(0);
		});
	});

	describe("invalid-schema.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "invalid-schema.vars"), "utf-8");
		const uri = "file:///project/.vars";

		it("reports errors for invalid schemas", () => {
			const diags = computeDiagnostics(text, uri);
			const errors = diags.filter((d) => d.source === "vars-schema");
			expect(errors.length).toBeGreaterThan(0);
		});

		it("does not report errors for valid schemas in the same file", () => {
			const diags = computeDiagnostics(text, uri);
			const errors = diags.filter((d) => d.source === "vars-schema");
			// VALID_ONE should not produce a schema error
			const validOneErrors = errors.filter((d) => d.message.includes("VALID_ONE"));
			expect(validOneErrors).toHaveLength(0);
		});
	});

	describe("metadata.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "metadata.vars"), "utf-8");
		const uri = "file:///project/.vars";

		it("shows deprecation warning for LEGACY_TOKEN", () => {
			const diags = computeDiagnostics(text, uri);
			const deprecated = diags.filter((d) => d.source === "vars-deprecated");
			expect(deprecated.length).toBeGreaterThan(0);
		});

		it("includes metadata in hover for API_KEY", () => {
			const result = computeHover({ text, line: 0, character: 3, uri });
			expect(result).not.toBeNull();
			expect(result?.contents).toContain("Primary API key");
		});
	});

	describe("extends-child.vars", () => {
		const text = readFileSync(resolve(FIXTURES, "extends-child.vars"), "utf-8");
		const uri = "file:///project/apps/web/.vars";

		it("provides go-to-definition for @extends", () => {
			const result = computeDefinition({ text, line: 0, character: 15, uri });
			expect(result).not.toBeNull();
			expect(result?.targetUri).toContain("extends-parent.vars");
		});
	});
});
