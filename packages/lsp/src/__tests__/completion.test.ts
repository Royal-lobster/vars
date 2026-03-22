import { describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node.js";
import { type CompletionContext, computeCompletions } from "../completion.js";

describe("completion", () => {
	describe("Zod method completions", () => {
		it("suggests string methods after z.string().", () => {
			const text = "MY_VAR  z.string().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("max");
			expect(labels).toContain("email");
			expect(labels).toContain("url");
			expect(labels).toContain("uuid");
			expect(labels).toContain("startsWith");
			expect(labels).toContain("optional");
		});

		it("suggests number methods after z.number().", () => {
			const text = "MY_VAR  z.number().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("max");
			expect(labels).toContain("int");
			expect(labels).toContain("positive");
		});

		it("suggests number methods after z.coerce.number().", () => {
			const text = "MY_VAR  z.coerce.number().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("int");
			expect(labels).toContain("min");
		});

		it("suggests methods after chained calls like z.string().url().", () => {
			const text = "MY_VAR  z.string().url().";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("min");
			expect(labels).toContain("startsWith");
		});

		it("suggests top-level z types after z.", () => {
			const text = "MY_VAR  z.";
			const ctx: CompletionContext = {
				text,
				line: 0,
				character: text.length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("string");
			expect(labels).toContain("number");
			expect(labels).toContain("boolean");
			expect(labels).toContain("enum");
			expect(labels).toContain("coerce");
		});
	});

	describe("environment name completions", () => {
		it("suggests env names on indented @ lines", () => {
			const fullText = ["PORT  z.coerce.number()", "  @"].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 1,
				character: 3,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("@dev");
			expect(labels).toContain("@staging");
			expect(labels).toContain("@prod");
			expect(labels).toContain("@default");
		});

		it("includes custom env names already used in the file", () => {
			const fullText = [
				"PORT  z.coerce.number()",
				"  @dev     = 3000",
				"  @myCustomEnv = 4000",
				"",
				"HOST  z.string()",
				"  @",
			].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 5,
				character: 3,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("@myCustomEnv");
		});
	});

	describe("directive completions", () => {
		it("suggests directives on indented @ lines when no = follows", () => {
			const fullText = ["API_KEY  z.string()", "  @d"].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 1,
				character: 4,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("@description");
			expect(labels).toContain("@deprecated");
			expect(labels).toContain("@expires");
			expect(labels).toContain("@owner");
		});

		it("suggests @public directive", () => {
			const fullText = ["PORT  z.coerce.number()", "  @p"].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 1,
				character: 4,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("@public");
		});

		it("@public insert text has no trailing value", () => {
			const fullText = ["PORT  z.coerce.number()", "  @"].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 1,
				character: 3,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const publicItem = items.find((i) => i.label === "@public");
			expect(publicItem).toBeDefined();
			expect(publicItem?.insertText).toBe("@public");
		});
	});

	describe("@refine variable completions", () => {
		it("suggests variable names after env. in @refine", () => {
			const fullText = [
				"PORT  z.coerce.number()",
				"  @default = 3000",
				"HOST  z.string()",
				"  @default = localhost",
				"@refine (env) => env.",
			].join("\n");
			const ctx: CompletionContext = {
				text: fullText,
				line: 4,
				character: fullText.split("\n")[4].length,
				uri: "/test/.vars",
			};
			const items = computeCompletions(ctx);
			const labels = items.map((i) => i.label);
			expect(labels).toContain("PORT");
			expect(labels).toContain("HOST");
		});
	});
});
