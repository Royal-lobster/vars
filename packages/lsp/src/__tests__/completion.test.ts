import { describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node.js";
import { type CompletionContext, computeCompletions } from "../completion.js";

describe("completion", () => {
	describe("top-level keyword completions", () => {
		it("suggests top-level keywords at an empty line", () => {
			const ctx: CompletionContext = {
				text: "",
				line: 0,
				character: 0,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("env");
			expect(labels).toContain("param");
			expect(labels).toContain("use");
			expect(labels).toContain("group");
			expect(labels).toContain("public");
			expect(labels).toContain("check");
		});

		it("suggests keywords when cursor is at start of line with spaces", () => {
			const ctx: CompletionContext = {
				text: "env(dev, prod)\n\n",
				line: 2,
				character: 0,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("env");
			expect(labels).toContain("group");
		});
	});

	describe("Zod method completions", () => {
		it("suggests top-level z types after z.", () => {
			const text = "MY_VAR : z.";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("string");
			expect(labels).toContain("number");
			expect(labels).toContain("boolean");
			expect(labels).toContain("enum");
			expect(labels).toContain("coerce");
		});

		it("suggests string methods after z.string().", () => {
			const text = "MY_VAR : z.string().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("max");
			expect(labels).toContain("email");
			expect(labels).toContain("url");
			expect(labels).toContain("optional");
		});

		it("suggests number methods after z.number().", () => {
			const text = "MY_VAR : z.number().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("max");
			expect(labels).toContain("int");
			expect(labels).toContain("positive");
		});

		it("suggests coerce subtypes after z.coerce.", () => {
			const text = "MY_VAR : z.coerce.";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("string");
			expect(labels).toContain("number");
			expect(labels).toContain("boolean");
		});

		it("suggests methods after chained calls like z.string().url().", () => {
			const text = "MY_VAR : z.string().url().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("optional");
		});
	});

	describe("metadata key completions", () => {
		it("suggests metadata keys inside metadata parens", () => {
			const text = ["env(dev, prod)", 'API_KEY : z.string() = "key" (', "  "].join("\n");
			const ctx: CompletionContext = {
				text,
				line: 2,
				character: 2,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("description");
			expect(labels).toContain("owner");
			expect(labels).toContain("expires");
			expect(labels).toContain("deprecated");
			expect(labels).toContain("tags");
		});
	});

	describe("check block completions", () => {
		it("suggests variable names and check keywords inside check blocks", () => {
			const text = [
				"env(dev, prod)",
				"public PORT : z.number() = 3000",
				'DATABASE_URL : z.string() = "postgres://localhost"',
				'check "port-check" {',
				"  ",
			].join("\n");
			const ctx: CompletionContext = {
				text,
				line: 4,
				character: 2,
				uri: "file:///test/app.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("PORT");
			expect(labels).toContain("DATABASE_URL");
			expect(labels).toContain("defined");
			expect(labels).toContain("and");
			expect(labels).toContain("or");
		});
	});
});
