import { parse } from "@dotvars/core";
import { describe, expect, it } from "vitest";
import { findDeclarationLine } from "../commands/remove.js";

describe("remove", () => {
	it("uses the parsed declaration line instead of matching multiline value text", () => {
		const source = `OTHER = """
FOO = "example"
"""
FOO = "real"
`;
		expect(findDeclarationLine(parse(source).ast.declarations, "FOO")).toBe(4);
	});
});
