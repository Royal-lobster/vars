import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { installHook } from "../../commands/hook.js";

describe("vars hook install", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-hook-test-"));
  });

  it("creates .git/hooks/pre-commit if no hooks directory exists", () => {
    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });

    installHook(tmpDir);

    const hookPath = join(tmpDir, ".git", "hooks", "pre-commit");
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, "utf8");
    expect(content).toContain("vars hide");
    expect(content).toContain("#!/bin/sh");
  });

  it("appends to existing pre-commit hook", () => {
    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });
    const hookPath = join(tmpDir, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\necho 'existing hook'\n");

    installHook(tmpDir);

    const content = readFileSync(hookPath, "utf8");
    expect(content).toContain("existing hook");
    expect(content).toContain("vars hide");
  });

  it("detects .husky directory and creates hook there", () => {
    mkdirSync(join(tmpDir, ".husky"), { recursive: true });
    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });

    installHook(tmpDir);

    const huskyHookPath = join(tmpDir, ".husky", "pre-commit");
    expect(existsSync(huskyHookPath)).toBe(true);

    const content = readFileSync(huskyHookPath, "utf8");
    expect(content).toContain("vars hide");
  });

  it("makes hook file executable", () => {
    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });

    installHook(tmpDir);

    const hookPath = join(tmpDir, ".git", "hooks", "pre-commit");
    const stat = statSync(hookPath);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });
});
