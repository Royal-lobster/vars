import { describe, expect, it } from "vitest";
import { schemaAllowsMissing, validationIssue } from "../commands/check.js";

describe("validationIssue", () => {
	it("does not expose schema messages for encrypted values", () => {
		expect(validationIssue(true, [{ message: "decrypted-secret" }])).toBe(
			"secret value does not match schema",
		);
	});
});

describe("schemaAllowsMissing", () => {
	it("accepts optional and defaulted schemas only", () => {
		expect(schemaAllowsMissing("z.string().optional()")).toBe(true);
		expect(schemaAllowsMissing('z.string().default("fallback")')).toBe(true);
		expect(schemaAllowsMissing("z.string()")).toBe(false);
	});
});
