import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showFile, hideFile } from "../show-hide.js";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMasterKey } from "../key-manager.js";

describe("show-hide", () => {
  let dir: string;
  let key: Buffer;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "vars-test-"));
    key = await createMasterKey();
  });

  afterEach(() => rmSync(dir, { recursive: true }));

  it("hide encrypts secret values, keeps public unchanged", () => {
    const content = `# @vars-state unlocked
env(dev, prod)

public APP_NAME = "my-app"
SECRET : z.string() {
  dev = "dev-secret"
}`;
    const f = join(dir, "config.vars");
    writeFileSync(f, content);
    hideFile(f, key);
    const result = readFileSync(f, "utf8");
    expect(result).toContain("# @vars-state locked");
    expect(result).toContain('APP_NAME = "my-app"');
    expect(result).toContain("enc:v2:aes256gcm-det:");
    expect(result).not.toContain("dev-secret");
  });

  it("show decrypts encrypted values", () => {
    const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
    const f = join(dir, "config.vars");
    writeFileSync(f, content);
    hideFile(f, key);
    showFile(f, key);
    const result = readFileSync(f, "utf8");
    expect(result).toContain("# @vars-state unlocked");
    expect(result).toContain("my-secret");
  });

  it("hide is deterministic — same output on repeated hide", () => {
    const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "same-value"
}`;
    const f = join(dir, "config.vars");
    writeFileSync(f, content);
    hideFile(f, key);
    const first = readFileSync(f, "utf8");
    showFile(f, key);
    hideFile(f, key);
    const second = readFileSync(f, "utf8");
    expect(first).toBe(second);
  });
});
