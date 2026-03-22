import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showFile, hideFile } from "../show-hide.js";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, renameSync } from "node:fs";
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
    // hideFile on a .vars file (not .unlocked.vars) keeps it at .vars
    const unlocked = showFile(f, key);
    const result = readFileSync(unlocked, "utf8");
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
    const unlocked = showFile(f, key);
    hideFile(unlocked, key);
    const second = readFileSync(f, "utf8");
    expect(first).toBe(second);
  });

  it("encrypts grouped variables correctly", async () => {
    const content = `# @vars-state unlocked
env(dev)

group stripe {
  SECRET_KEY : z.string() {
    dev = "sk_secret_value"
  }
  public PUB_KEY : z.string() {
    dev = "pk_public_value"
  }
}`;
    const f = join(dir, "grouped.vars");
    writeFileSync(f, content);
    hideFile(f, key);
    const result = readFileSync(f, "utf8");
    expect(result).toContain("enc:v2:aes256gcm-det:"); // secret encrypted
    expect(result).toContain('"pk_public_value"'); // public unchanged
    expect(result).not.toContain("sk_secret_value"); // secret not in plaintext
  });

  it("show renames .vars to .unlocked.vars and decrypts", () => {
    const content = `# @vars-state locked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
    const locked = join(dir, "config.vars");
    const unlocked = join(dir, "config.unlocked.vars");
    writeFileSync(locked, content);
    hideFile(locked, key);
    showFile(locked, key);

    expect(existsSync(locked)).toBe(false);
    expect(existsSync(unlocked)).toBe(true);
    const result = readFileSync(unlocked, "utf8");
    expect(result).toContain("# @vars-state unlocked");
    expect(result).toContain("my-secret");
  });

  it("show is idempotent — re-running on .unlocked.vars re-decrypts", () => {
    const content = `# @vars-state locked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
    const locked = join(dir, "config.vars");
    const unlocked = join(dir, "config.unlocked.vars");
    writeFileSync(locked, content);
    hideFile(locked, key);
    // Simulate crash: rename but don't decrypt
    renameSync(locked, unlocked);
    // Re-run show — should detect .unlocked.vars and re-decrypt
    showFile(unlocked, key);
    const result = readFileSync(unlocked, "utf8");
    expect(result).toContain("# @vars-state unlocked");
    expect(result).toContain("my-secret");
  });

  it("hide renames .unlocked.vars back to .vars after encrypting", () => {
    const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
    const unlocked = join(dir, "config.unlocked.vars");
    const locked = join(dir, "config.vars");
    writeFileSync(unlocked, content);
    hideFile(unlocked, key);

    expect(existsSync(unlocked)).toBe(false);
    expect(existsSync(locked)).toBe(true);
    const result = readFileSync(locked, "utf8");
    expect(result).toContain("# @vars-state locked");
    expect(result).toContain("enc:v2:aes256gcm-det:");
    expect(result).not.toContain("my-secret");
  });

  it("hide is idempotent — already-encrypted values are not double-encrypted", () => {
    const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
    const unlocked = join(dir, "config.unlocked.vars");
    writeFileSync(unlocked, content);
    hideFile(unlocked, key);
    const locked = join(dir, "config.vars");
    const first = readFileSync(locked, "utf8");

    // Unlock again, then hide again
    showFile(locked, key);
    hideFile(join(dir, "config.unlocked.vars"), key);
    const second = readFileSync(locked, "utf8");
    expect(first).toBe(second);
  });

  it("handles flat (non-env-block) encrypted values in show", async () => {
    // First create a file with a flat encrypted value
    const content = `# @vars-state unlocked
env(dev)

SECRET = "flat-secret"`;
    const f = join(dir, "flat.vars");
    writeFileSync(f, content);
    hideFile(f, key);

    const encrypted = readFileSync(f, "utf8");
    expect(encrypted).toContain("enc:v2:"); // encrypted
    expect(encrypted).not.toContain("flat-secret");

    const unlockedFlat = showFile(f, key);
    const decrypted = readFileSync(unlockedFlat, "utf8");
    expect(decrypted).toContain("flat-secret"); // restored
  });

  it("full cycle: hide → show → edit → hide produces correct output", () => {
    const content = `# @vars-state unlocked
env(dev, prod)

public APP_NAME = "my-app"
SECRET : z.string() {
  dev = "dev-secret"
  prod = "prod-secret"
}`;
    const locked = join(dir, "config.vars");
    writeFileSync(locked, content);

    // Hide: encrypts and stays at .vars (since input is .vars)
    hideFile(locked, key);
    expect(existsSync(locked)).toBe(true);
    expect(readFileSync(locked, "utf8")).toContain("# @vars-state locked");

    // Show: renames to .unlocked.vars and decrypts
    const unlocked = showFile(locked, key);
    expect(unlocked).toBe(join(dir, "config.unlocked.vars"));
    expect(existsSync(locked)).toBe(false);
    expect(existsSync(unlocked)).toBe(true);
    expect(readFileSync(unlocked, "utf8")).toContain("dev-secret");

    // Simulate edit: change a value
    const edited = readFileSync(unlocked, "utf8").replace("dev-secret", "new-dev-secret");
    writeFileSync(unlocked, edited);

    // Hide: encrypts and renames back to .vars
    const finalLocked = hideFile(unlocked, key);
    expect(finalLocked).toBe(locked);
    expect(existsSync(unlocked)).toBe(false);
    expect(existsSync(locked)).toBe(true);
    const final = readFileSync(locked, "utf8");
    expect(final).toContain("# @vars-state locked");
    expect(final).not.toContain("new-dev-secret");
    expect(final).toContain("enc:v2:aes256gcm-det:");

    // Verify the new value is recoverable
    const unlocked2 = showFile(locked, key);
    expect(readFileSync(unlocked2, "utf8")).toContain("new-dev-secret");
  });

  it("hide overwrites stale .vars when .unlocked.vars is the source of truth", () => {
    const content = `# @vars-state unlocked
env(dev)

SECRET : z.string() {
  dev = "latest-secret"
}`;
    const unlocked = join(dir, "config.unlocked.vars");
    const locked = join(dir, "config.vars");
    // Simulate: both files exist (e.g., git restored .vars while .unlocked.vars on disk)
    writeFileSync(unlocked, content);
    writeFileSync(locked, "# stale content");
    hideFile(unlocked, key);

    expect(existsSync(unlocked)).toBe(false);
    expect(existsSync(locked)).toBe(true);
    const result = readFileSync(locked, "utf8");
    expect(result).toContain("enc:v2:aes256gcm-det:");
    expect(result).not.toContain("stale content");
  });
});
