import { describe, expect, it } from "vitest";
import { mutateVarsSource } from "../utils/vars-source-mutation.js";

describe("remove", () => {
	it("removes the parsed declaration instead of matching multiline value text", () => {
		const source = `OTHER = """
FOO = "example"
"""
FOO = "real"
`;

		const result = mutateVarsSource(source, "config.vars", { kind: "remove", target: "FOO" });

		expect(result.content).toContain('FOO = "example"');
		expect(result.content).not.toContain('FOO = "real"');
	});
});
