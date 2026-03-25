import { describe, expect, it } from "vitest";
import { type CodeActionContext, computeCodeActions } from "../code-actions.js";

describe("code-actions", () => {
	it("returns empty array (minimal implementation)", () => {
		const ctx: CodeActionContext = {
			text: ["env(dev, prod)", "PORT : z.number() = 3000"].join("\n"),
			startLine: 0,
			endLine: 1,
			uri: "file:///test/app.vars",
		};
		const actions = computeCodeActions(ctx);
		expect(Array.isArray(actions)).toBe(true);
		expect(actions).toHaveLength(0);
	});
});
