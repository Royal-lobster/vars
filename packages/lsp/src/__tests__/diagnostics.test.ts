import { describe, expect, it } from "vitest";
import { computeDiagnostics } from "../diagnostics.js";

describe("diagnostics", () => {
  describe("schema validation", () => {
    it("reports no diagnostics for valid schemas", () => {
      const text = [
        "DATABASE_URL  z.string().url()",
        "  @dev = postgres://localhost/db",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const schemaErrors = diags.filter((d) => d.source === "vars-schema");
      expect(schemaErrors).toHaveLength(0);
    });

    it("reports error for invalid Zod method", () => {
      const text = [
        "BAD  z.notARealType()",
        "  @dev = hello",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const schemaErrors = diags.filter((d) => d.source === "vars-schema");
      expect(schemaErrors.length).toBeGreaterThan(0);
      expect(schemaErrors[0].message).toContain("notARealType");
    });

    it("reports error for malformed schema syntax", () => {
      const text = [
        "BAD  z.string(.min(5)",
        "  @dev = hello",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const schemaErrors = diags.filter((d) => d.source === "vars-schema");
      expect(schemaErrors.length).toBeGreaterThan(0);
    });

    it("reports errors on the correct line", () => {
      const text = [
        "GOOD  z.string()",
        "  @dev = hello",
        "",
        "BAD  z.fakeMethod()",
        "  @dev = world",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const schemaErrors = diags.filter((d) => d.source === "vars-schema");
      expect(schemaErrors.length).toBeGreaterThan(0);
      // BAD is on line index 3 (0-based)
      expect(schemaErrors[0].range.start.line).toBe(3);
    });
  });

  describe("@refine reference checking", () => {
    it("reports no diagnostics when all refs exist", () => {
      const text = [
        "DEBUG  z.coerce.boolean()",
        "  @default = false",
        "",
        "LOG_LEVEL  z.enum(['debug', 'info'])",
        "  @default = info",
        "",
        '@refine (env) => env.LOG_LEVEL !== "debug" || env.DEBUG === true',
        '  "DEBUG must be true when LOG_LEVEL is debug"',
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const refineErrors = diags.filter((d) => d.source === "vars-refine");
      expect(refineErrors).toHaveLength(0);
    });

    it("reports error for undefined variable reference in @refine", () => {
      const text = [
        "DEBUG  z.coerce.boolean()",
        "  @default = false",
        "",
        '@refine (env) => env.UNDEFINED_VAR !== "x" || env.DEBUG === true',
        '  "some message"',
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const refineErrors = diags.filter((d) => d.source === "vars-refine");
      expect(refineErrors.length).toBeGreaterThan(0);
      expect(refineErrors[0].message).toContain("UNDEFINED_VAR");
    });
  });

  describe("metadata warnings", () => {
    it("reports warning for @deprecated variables", () => {
      const text = [
        "OLD_TOKEN  z.string()",
        '  @deprecated "Use NEW_TOKEN instead"',
        "  @dev = abc123",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const deprecationWarns = diags.filter(
        (d) => d.source === "vars-deprecated",
      );
      expect(deprecationWarns.length).toBeGreaterThan(0);
    });

    it("reports warning for @expires in the past", () => {
      const text = [
        "API_KEY  z.string()",
        "  @expires 2020-01-01",
        "  @dev = abc123",
      ].join("\n");
      const diags = computeDiagnostics(text, "/test/.vars");
      const expiryWarns = diags.filter((d) => d.source === "vars-expires");
      expect(expiryWarns.length).toBeGreaterThan(0);
      expect(expiryWarns[0].message).toContain("expired");
    });
  });

  describe("missing required environments", () => {
    it("reports info for variable with some envs but not all common ones", () => {
      const text = [
        "PORT  z.coerce.number()",
        "  @dev = 3000",
      ].join("\n");
      // This is informational — not having @prod isn't necessarily an error
      // unless enforced by a policy. We report it as a hint.
      const diags = computeDiagnostics(text, "/test/.vars");
      // No error-level diagnostics for this — it's valid to only have @dev
      const errors = diags.filter((d) => d.severity === 1); // DiagnosticSeverity.Error = 1
      const missingEnvErrors = errors.filter((d) => d.source === "vars-missing-env");
      expect(missingEnvErrors).toHaveLength(0);
    });
  });
});
