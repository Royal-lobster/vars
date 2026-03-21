import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { encrypt } from "@vars/core";
import { buildPushPayload } from "../../commands/push.js";

describe("vars push", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-push-test-"));
    key = randomBytes(32);
  });

  it("builds a payload of decrypted key-value pairs", () => {
    const encPort = encrypt("8080", key);
    const encHost = encrypt("prod.example.com", key);

    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        `  @prod = ${encPort}`,
        "",
        "HOST  z.string()",
        `  @prod = ${encHost}`,
      ].join("\n"),
    );

    const payload = buildPushPayload(join(tmpDir, ".vars"), "prod", key);
    expect(payload.variables).toEqual({
      PORT: "8080",
      HOST: "prod.example.com",
    });
  });

  it("resolves env-specific values with default fallback", () => {
    const encDefault = encrypt("3000", key);
    const encProd = encrypt("8080", key);

    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "PORT  z.coerce.number()",
        `  @default = ${encDefault}`,
        `  @prod    = ${encProd}`,
      ].join("\n"),
    );

    const payload = buildPushPayload(join(tmpDir, ".vars"), "prod", key);
    expect(payload.variables.PORT).toBe("8080");

    const devPayload = buildPushPayload(join(tmpDir, ".vars"), "dev", key);
    expect(devPayload.variables.PORT).toBe("3000");
  });

  it("skips undefined optional variables", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      [
        "OPTIONAL  z.string().optional()",
        "  @prod = prod-only",
      ].join("\n"),
    );

    const payload = buildPushPayload(join(tmpDir, ".vars"), "dev", key);
    expect(payload.variables.OPTIONAL).toBeUndefined();
  });
});
