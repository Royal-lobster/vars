import { describe, expect, it } from "vitest";
import { Redacted } from "../redacted.js";

describe("Redacted", () => {
  it("hides value in toString()", () => {
    const r = new Redacted("my-secret");
    expect(r.toString()).toBe("<redacted>");
  });

  it("hides value in toJSON()", () => {
    const r = new Redacted("my-secret");
    expect(r.toJSON()).toBe("<redacted>");
  });

  it("hides value in JSON.stringify()", () => {
    const r = new Redacted("my-secret");
    expect(JSON.stringify({ key: r })).toBe('{"key":"<redacted>"}');
  });

  it("hides value in template literals", () => {
    const r = new Redacted("my-secret");
    expect(`value: ${r}`).toBe("value: <redacted>");
  });

  it("exposes value via unwrap()", () => {
    const r = new Redacted("my-secret");
    expect(r.unwrap()).toBe("my-secret");
  });

  it("hides value in console.log (Node.js inspect)", () => {
    const r = new Redacted("my-secret");
    const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");
    expect((r as any)[inspectSymbol]()).toBe("<redacted>");
  });

  it("works with non-string types", () => {
    const r = new Redacted(42);
    expect(r.unwrap()).toBe(42);
    expect(r.toString()).toBe("<redacted>");
  });
});
