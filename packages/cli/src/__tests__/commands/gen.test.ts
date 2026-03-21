import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { generateFromFile } from "../../commands/gen.js";

describe("vars gen", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-gen-test-"));
  });

  it("generates env.generated.ts from .vars", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number().int().min(1024)",
        "  @default = 3000",
        "",
        "HOST  z.string()",
        "  @default = localhost",
        "",
        "DEBUG  z.coerce.boolean()",
        "  @default = false",
      ].join("\n"),
    );

    const outputPath = join(tmpDir, "env.generated.ts");
    generateFromFile(join(tmpDir, ".vars"), outputPath);

    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, "utf8");

    expect(content).toContain("auto-generated");
    expect(content).toContain('import { z } from "zod"');
    expect(content).toContain("PORT: z.coerce.number().int().min(1024)");
    expect(content).toContain("HOST: z.string()");
    expect(content).toContain("DEBUG: z.coerce.boolean()");
    expect(content).toContain("PORT: number");
    expect(content).toContain("HOST: Redacted<string>");
    expect(content).toContain("DEBUG: boolean");
  });

  it("marks optional variables with ? in Env type", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "OPTIONAL_KEY  z.string().optional()",
        "  @prod = only-in-prod",
      ].join("\n"),
    );

    const outputPath = join(tmpDir, "env.generated.ts");
    generateFromFile(join(tmpDir, ".vars"), outputPath);

    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("OPTIONAL_KEY?: Redacted<string>");
  });

  it("generates enum literal union types", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        'LOG_LEVEL  z.enum(["debug", "info", "warn", "error"])',
        "  @default = info",
      ].join("\n"),
    );

    const outputPath = join(tmpDir, "env.generated.ts");
    generateFromFile(join(tmpDir, ".vars"), outputPath);

    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain('"debug" | "info" | "warn" | "error"');
  });
});
