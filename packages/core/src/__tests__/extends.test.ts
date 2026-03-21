import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExtends } from "../extends.js";

const fixtureDir = resolve(__dirname, "fixtures");

describe("extends", () => {
  it("merges parent variables into child", () => {
    const result = resolveExtends(resolve(fixtureDir, "extends-child.vars"));
    const names = result.variables.map((v) => v.name);
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("SHARED_KEY");
    expect(names).toContain("APP_NAME");
  });

  it("child values override parent values", () => {
    const result = resolveExtends(resolve(fixtureDir, "extends-child.vars"));
    const db = result.variables.find((v) => v.name === "DATABASE_URL")!;
    const devVal = db.values.find((v) => v.env === "dev");
    expect(devVal?.value).toContain("child_dev");
  });

  it("inherits parent values not overridden by child", () => {
    const result = resolveExtends(resolve(fixtureDir, "extends-child.vars"));
    const db = result.variables.find((v) => v.name === "DATABASE_URL")!;
    const prodVal = db.values.find((v) => v.env === "prod");
    expect(prodVal?.value).toContain("parent");
  });

  it("inherits parent-only variables", () => {
    const result = resolveExtends(resolve(fixtureDir, "extends-child.vars"));
    const shared = result.variables.find((v) => v.name === "SHARED_KEY")!;
    expect(shared.values.find((v) => v.env === "default")?.value).toBe("parent-default-key");
  });

  it("works when no @extends (returns parsed file as-is)", () => {
    const result = resolveExtends(resolve(fixtureDir, "basic.vars"));
    expect(result.variables.length).toBeGreaterThan(0);
    expect(result.extendsPath).toBeNull();
  });

  it("throws on circular extends", () => {
    expect(() =>
      resolveExtends(resolve(fixtureDir, "extends-circular-a.vars")),
    ).toThrow();
  });

  it("throws on missing parent file", () => {
    expect(() =>
      resolveExtends(resolve(fixtureDir, "extends-missing-parent.vars")),
    ).toThrow();
  });
});
