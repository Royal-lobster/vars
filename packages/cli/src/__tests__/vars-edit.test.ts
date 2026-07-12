import { describe, expect, it } from "vitest";
import { quoteValue } from "../commands/set.js";
import { findDeclarationEndLine, quoteVarsString, trailingMetadata } from "../utils/vars-edit.js";

describe("vars editing", () => {
	it("quotes line breaks instead of emitting syntax", () => {
		expect(quoteVarsString('x\npublic INJECTED = "yes"')).toBe('"x\\npublic INJECTED = \\"yes\\""');
	});

	it("rejects control characters the tokenizer cannot round-trip", () => {
		expect(() => quoteVarsString("x\0y")).toThrow("control characters");
	});

	it("preserves valid arrays but quotes object-like strings", () => {
		expect(quoteValue('["one"]')).toBe('["one"]');
		expect(quoteValue('{"one":1}')).toBe('"{\\"one\\":1}"');
	});

	it("finds blocks without counting braces in strings and includes metadata", () => {
		const source = `SECRET : z.string() {
  dev = "a } value"
  prod = "b { value"
} (owner = "team")
NEXT = "kept"
`;
		expect(findDeclarationEndLine(source, 0)).toBe(3);
	});

	it("includes metadata on the following lines", () => {
		const source = `SECRET = "value"
(
  owner = "team"
)
NEXT = "kept"
`;
		expect(findDeclarationEndLine(source, 0)).toBe(3);
	});

	it("preserves metadata containing parentheses", () => {
		expect(trailingMetadata('SECRET = "value" (description = "call (team)", owner = "ops")')).toBe(
			'(description = "call (team)", owner = "ops")',
		);
	});

	it("ignores unmatched parentheses in trailing comments", () => {
		expect(trailingMetadata('SECRET = "value" (owner = "ops") # note (')).toBe(
			'(owner = "ops") # note (',
		);
	});
});
