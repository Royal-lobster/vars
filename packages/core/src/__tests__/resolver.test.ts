import { describe, expect, it } from "vitest";
import { resolveValue, resolveAllValues } from "../resolver.js";
import type { Variable } from "../types.js";

describe("resolver", () => {
  describe("resolveValue", () => {
    const makeVar = (values: Array<{ env: string; value: string }>): Variable => ({
      name: "TEST",
      schema: "z.string()",
      values: values.map((v) => ({ ...v, line: 1 })),
      metadata: {},
      line: 1,
    });

    it("returns @env value when available", () => {
      const v = makeVar([
        { env: "dev", value: "dev-val" },
        { env: "default", value: "default-val" },
      ]);
      expect(resolveValue(v, "dev")).toBe("dev-val");
    });

    it("falls back to @default when env not found", () => {
      const v = makeVar([{ env: "default", value: "default-val" }]);
      expect(resolveValue(v, "prod")).toBe("default-val");
    });

    it("returns undefined when no matching value", () => {
      const v = makeVar([{ env: "dev", value: "dev-val" }]);
      expect(resolveValue(v, "prod")).toBeUndefined();
    });

    it("resolves 'development' to @dev values", () => {
      const v = makeVar([
        { env: "dev", value: "dev-val" },
        { env: "default", value: "default-val" },
      ]);
      expect(resolveValue(v, "development")).toBe("dev-val");
    });

    it("resolves 'production' to @prod values", () => {
      const v = makeVar([
        { env: "prod", value: "prod-val" },
      ]);
      expect(resolveValue(v, "production")).toBe("prod-val");
    });

    it("prefers exact env over default", () => {
      const v = makeVar([
        { env: "prod", value: "prod-val" },
        { env: "default", value: "default-val" },
      ]);
      expect(resolveValue(v, "prod")).toBe("prod-val");
    });
  });

  describe("resolveAllValues", () => {
    it("resolves all variables for an environment", () => {
      const variables: Variable[] = [
        {
          name: "PORT",
          schema: "z.coerce.number()",
          values: [
            { env: "default", value: "3000", line: 1 },
            { env: "prod", value: "8080", line: 2 },
          ],
          metadata: {},
          line: 1,
        },
        {
          name: "HOST",
          schema: "z.string()",
          values: [{ env: "default", value: "localhost", line: 1 }],
          metadata: {},
          line: 2,
        },
      ];

      const resolved = resolveAllValues(variables, "prod");
      expect(resolved.get("PORT")).toBe("8080");
      expect(resolved.get("HOST")).toBe("localhost");
    });

    it("includes undefined for missing required values", () => {
      const variables: Variable[] = [
        {
          name: "REQUIRED",
          schema: "z.string()",
          values: [{ env: "dev", value: "val", line: 1 }],
          metadata: {},
          line: 1,
        },
      ];

      const resolved = resolveAllValues(variables, "prod");
      expect(resolved.has("REQUIRED")).toBe(true);
      expect(resolved.get("REQUIRED")).toBeUndefined();
    });
  });
});
