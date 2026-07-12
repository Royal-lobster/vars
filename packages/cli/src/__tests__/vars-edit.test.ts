import { describe, expect, it } from "vitest";
import { findDeclarationEndLine, quoteVarsString, trailingMetadata } from "../utils/vars-edit.js";

describe("vars editing", () => {
	it("quotes line breaks instead of emitting syntax", () => {
		expect(quoteVarsString('x\npublic INJECTED = "yes"')).toBe('"x\\npublic INJECTED = \\"yes\\""');
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
});
