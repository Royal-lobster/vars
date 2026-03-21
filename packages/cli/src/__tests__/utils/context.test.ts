import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findVarsFile, findKeyFile, resolveEnv, buildContext } from "../../utils/context.js";

describe("context", () => {
  function makeTmpDir(): string {
    return mkdtempSync(join(tmpdir(), "vars-cli-test-"));
  }

  describe("findVarsFile", () => {
    it("finds .vars in current directory", () => {
      const dir = makeTmpDir();
      writeFileSync(join(dir, ".vars"), "PORT  z.number()\n  @default = 3000\n");
      expect(findVarsFile(dir)).toBe(resolve(dir, ".vars"));
    });

    it("finds .vars in parent directory", () => {
      const root = makeTmpDir();
      writeFileSync(join(root, ".vars"), "PORT  z.number()\n  @default = 3000\n");
      const child = join(root, "subdir");
      mkdirSync(child);
      expect(findVarsFile(child)).toBe(resolve(root, ".vars"));
    });

    it("returns null when no .vars found", () => {
      const dir = makeTmpDir();
      expect(findVarsFile(dir)).toBeNull();
    });
  });

  describe("findKeyFile", () => {
    it("returns .vars.key next to .vars file", () => {
      expect(findKeyFile("/project/.vars")).toBe(resolve("/project/.vars.key"));
    });
  });

  describe("resolveEnv", () => {
    it("returns mapped short name for known aliases", () => {
      expect(resolveEnv("production")).toBe("prod");
    });

    it("passes through unknown env names unchanged", () => {
      expect(resolveEnv("custom-env")).toBe("custom-env");
    });

    it("falls back to VARS_ENV", () => {
      const old = process.env.VARS_ENV;
      process.env.VARS_ENV = "staging";
      expect(resolveEnv()).toBe("staging");
      if (old !== undefined) {
        process.env.VARS_ENV = old;
      } else {
        delete process.env.VARS_ENV;
      }
    });

    it("defaults to dev", () => {
      const old = process.env.VARS_ENV;
      delete process.env.VARS_ENV;
      expect(resolveEnv()).toBe("dev");
      if (old !== undefined) {
        process.env.VARS_ENV = old;
      }
    });

    it("maps 'development' to 'dev'", () => {
      expect(resolveEnv("development")).toBe("dev");
    });

    it("maps 'production' to 'prod'", () => {
      expect(resolveEnv("production")).toBe("prod");
    });
  });

  describe("buildContext", () => {
    it("builds context with defaults", () => {
      const dir = makeTmpDir();
      writeFileSync(join(dir, ".vars"), "");
      const ctx = buildContext({ cwd: dir });
      expect(ctx.varsFilePath).toBe(resolve(dir, ".vars"));
      expect(ctx.keyFilePath).toBe(resolve(dir, ".vars.key"));
      expect(ctx.env).toBe("dev");
    });

    it("respects explicit file path", () => {
      const dir = makeTmpDir();
      const ctx = buildContext({ file: "custom.vars", cwd: dir });
      expect(ctx.varsFilePath).toBe(resolve(dir, "custom.vars"));
    });
  });
});
