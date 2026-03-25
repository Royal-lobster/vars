import { describe, expect, it } from "vitest";
import { type DefinitionContext, computeDefinition } from "../definition.js";

describe("definition", () => {
	it("resolves use path on the use line", () => {
		const text = ['use "./base.vars"', "", "PORT : z.number() = 3000"].join("\n");
		const result = computeDefinition({
			text,
			line: 0,
			character: 5,
			uri: "file:///project/apps/web/app.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.targetUri).toContain("base.vars");
	});

	it("returns null for non-use lines", () => {
		const text = ["env(dev, prod)", "PORT : z.number() = 3000"].join("\n");
		const result = computeDefinition({
			text,
			line: 1,
			character: 5,
			uri: "file:///project/app.vars",
		});
		expect(result).toBeNull();
	});

	it("resolves relative use paths correctly", () => {
		const text = 'use "../../base.vars"';
		const result = computeDefinition({
			text,
			line: 0,
			character: 5,
			uri: "file:///project/apps/web/app.vars",
		});
		expect(result).not.toBeNull();
		expect(result?.targetUri).toBe("file:///project/base.vars");
	});

	it("returns null for comment lines", () => {
		const text = "# This is a comment";
		const result = computeDefinition({
			text,
			line: 0,
			character: 5,
			uri: "file:///project/app.vars",
		});
		expect(result).toBeNull();
	});
});
