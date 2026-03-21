import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { getStatus } from "../../commands/status.js";

describe("vars status", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-status-test-"));
    key = randomBytes(32);
  });

  it("reports encrypted state", () => {
    const encValue = encrypt("secret", key);
    writeFileSync(
      join(tmpDir, ".vars"),
      `KEY  z.string()\n  @dev = ${encValue}\n`,
    );

    const status = getStatus(join(tmpDir, ".vars"));
    expect(status.encrypted).toBe(true);
    expect(status.variableCount).toBe(1);
  });

  it("reports decrypted state", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "KEY  z.string()\n  @dev = plaintext\n",
    );

    const status = getStatus(join(tmpDir, ".vars"));
    expect(status.encrypted).toBe(false);
  });

  it("counts variables correctly", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "A  z.string()",
        "  @default = a",
        "B  z.string()",
        "  @default = b",
        "C  z.string()",
        "  @default = c",
      ].join("\n"),
    );

    const status = getStatus(join(tmpDir, ".vars"));
    expect(status.variableCount).toBe(3);
  });

  it("lists available environments", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        "  @dev     = 3000",
        "  @staging = 4000",
        "  @prod    = 8080",
      ].join("\n"),
    );

    const status = getStatus(join(tmpDir, ".vars"));
    expect(status.environments).toContain("dev");
    expect(status.environments).toContain("staging");
    expect(status.environments).toContain("prod");
  });
});
