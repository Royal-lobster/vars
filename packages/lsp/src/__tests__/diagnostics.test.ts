import { describe, expect, it } from "vitest";
import { computeDiagnostics } from "../diagnostics.js";

describe("diagnostics", () => {
  describe("parse errors", () => {
    it("reports no diagnostics for valid v2 syntax", () => {
      const text = [
        "env(dev, prod)",
        "",
        'DATABASE_URL : z.string().url() {',
        '  dev  = "postgres://localhost:5432/myapp"',
        '  prod = enc:v2:aes256gcm-det:abc:def:ghi',
        "}",
      ].join("\n");
      const diags = computeDiagnostics(text, "file:///test/app.vars");
      expect(diags).toHaveLength(0);
    });

    it("reports no diagnostics for simple public variable", () => {
      const text = [
        "env(dev, prod)",
        'public APP_NAME = "my-app"',
      ].join("\n");
      const diags = computeDiagnostics(text, "file:///test/app.vars");
      expect(diags).toHaveLength(0);
    });
  });

  describe("metadata warnings", () => {
    it("reports warning for deprecated variables", () => {
      const text = [
        "env(dev, prod)",
        "",
        'API_KEY : z.string() {',
        '  dev  = "example-key"',
        '  prod = enc:v2:aes256gcm-det:abc:def:ghi',
        "} (",
        '  deprecated = "Use NEW_API_KEY instead"',
        ")",
      ].join("\n");
      const diags = computeDiagnostics(text, "file:///test/app.vars");
      const deprecationWarns = diags.filter((d) => d.message.includes("deprecated"));
      expect(deprecationWarns.length).toBeGreaterThan(0);
    });

    it("reports warning for expired variables", () => {
      const text = [
        "env(dev, prod)",
        "",
        'API_KEY : z.string() {',
        '  dev  = "example-key"',
        '  prod = enc:v2:aes256gcm-det:abc:def:ghi',
        "} (",
        "  expires = 2020-01-01",
        ")",
      ].join("\n");
      const diags = computeDiagnostics(text, "file:///test/app.vars");
      const expiredWarns = diags.filter((d) => d.message.includes("expired"));
      expect(expiredWarns.length).toBeGreaterThan(0);
    });

    it("reports both deprecated and expired warnings", () => {
      const text = [
        "env(dev, prod)",
        "",
        'OLD_KEY : z.string() {',
        '  dev  = "old-key"',
        '  prod = enc:v2:aes256gcm-det:abc:def:ghi',
        "} (",
        '  deprecated = "Use NEW_KEY instead"',
        "  expires = 2020-06-01",
        ")",
      ].join("\n");
      const diags = computeDiagnostics(text, "file:///test/app.vars");
      expect(diags.length).toBeGreaterThanOrEqual(2);
    });
  });
});
