import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { addVariable } from "../../commands/add.js";

describe("vars add", () => {
  let tmpDir: string;
  let key: Buffer;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-add-test-"));
    key = randomBytes(32);
  });

  it("adds a new variable to .vars file", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    addVariable(join(tmpDir, ".vars"), key, {
      name: "HOST",
      schema: "z.string()",
      values: [{ env: "default", value: "localhost" }],
    });

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("HOST  z.string()");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("encrypts the value when adding", () => {
    writeFileSync(join(tmpDir, ".vars"), "");

    addVariable(join(tmpDir, ".vars"), key, {
      name: "SECRET",
      schema: "z.string()",
      values: [{ env: "dev", value: "my-secret" }],
    });

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).not.toContain("my-secret");
    expect(content).toContain("enc:v1:aes256gcm:");
  });

  it("adds multiple env values", () => {
    writeFileSync(join(tmpDir, ".vars"), "");

    addVariable(join(tmpDir, ".vars"), key, {
      name: "DB_URL",
      schema: "z.string().url()",
      values: [
        { env: "dev", value: "postgres://localhost/dev" },
        { env: "prod", value: "postgres://prod.db/app" },
      ],
    });

    const content = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(content).toContain("@dev");
    expect(content).toContain("@prod");
  });

  it("throws if variable already exists", () => {
    writeFileSync(
      join(tmpDir, ".vars"),
      "PORT  z.coerce.number()\n  @default = 3000\n",
    );

    expect(() =>
      addVariable(join(tmpDir, ".vars"), key, {
        name: "PORT",
        schema: "z.coerce.number()",
        values: [{ env: "default", value: "8080" }],
      }),
    ).toThrow("already exists");
  });
});
