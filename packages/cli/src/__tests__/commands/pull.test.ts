import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { mergePulledVars } from "../../commands/pull.js";

describe("vars pull", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-pull-test-"));
    key = randomBytes(32);
  });

  it("creates a new .vars file from pulled variables", () => {
    const pulled = {
      PORT: "8080",
      HOST: "prod.example.com",
      API_KEY: "sk_live_abc123",
    };

    mergePulledVars(join(tmpDir, ".vars"), key, pulled, "prod");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("PORT");
    expect(content).toContain("HOST");
    expect(content).toContain("API_KEY");
    expect(content).toContain("enc:v1:aes256gcm:");
    expect(content).not.toContain("sk_live_abc123");
  });

  it("merges into existing .vars file without overwriting other envs", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @dev = 3000\n",
    );

    const pulled = { PORT: "8080" };
    mergePulledVars(join(tmpDir, ".vars"), key, pulled, "prod");

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("@dev");
    expect(content).toContain("@prod");
  });
});
