import { describe, expect, it } from "vitest";
import { Redacted } from "../redacted.js";

describe("Redacted", () => {
	it("wraps and unwraps a value", () => {
		const r = new Redacted("secret");
		expect(r.unwrap()).toBe("secret");
	});

	it("toString returns <redacted>", () => {
		expect(String(new Redacted("secret"))).toBe("<redacted>");
	});

	it("toJSON returns <redacted>", () => {
		expect(JSON.stringify({ key: new Redacted("secret") })).toBe('{"key":"<redacted>"}');
	});

	it("console.log does not reveal value", () => {
		const r = new Redacted("secret");
		const inspected = (r as any)[Symbol.for("nodejs.util.inspect.custom")]();
		expect(inspected).toBe("<redacted>");
	});
});
