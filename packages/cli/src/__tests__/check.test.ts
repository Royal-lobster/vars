import { describe, expect, it } from "vitest";
import { validationIssue } from "../commands/check.js";

describe("validationIssue", () => {
	it("does not expose schema messages for encrypted values", () => {
		expect(validationIssue(true, [{ message: "decrypted-secret" }])).toBe(
			"secret value does not match schema",
		);
	});
});
