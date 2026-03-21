import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { runDoctorChecks } from "../../commands/doctor.js";

describe("vars doctor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-doctor-test-"));
  });

  it("passes all checks when everything is set up correctly", () => {
    writeFileSync(join(tmpDir, ".vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(tmpDir, ".vars.key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars.key\n.env\n");

    const checks = runDoctorChecks(tmpDir);
    const passing = checks.filter((c) => c.status === "pass");
    expect(passing.length).toBeGreaterThan(0);
  });

  it("warns when .vars file is missing", () => {
    const checks = runDoctorChecks(tmpDir);
    const fail = checks.find((c) => c.name === "vars-file");
    expect(fail?.status).toBe("fail");
  });

  it("warns when .vars.key is missing", () => {
    writeFileSync(join(tmpDir, ".vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    const checks = runDoctorChecks(tmpDir);
    const warn = checks.find((c) => c.name === "key-file");
    expect(warn?.status).toBe("fail");
  });

  it("warns when .vars.key not in .gitignore", () => {
    writeFileSync(join(tmpDir, ".vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(tmpDir, ".vars.key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), "node_modules/\n");

    const checks = runDoctorChecks(tmpDir);
    const warn = checks.find((c) => c.name === "gitignore");
    expect(warn?.status).toBe("warn");
  });

  it("warns when .vars file has plaintext values (not encrypted)", () => {
    writeFileSync(join(tmpDir, ".vars"), "SECRET  z.string()\n  @dev = plaintext-secret\n");
    writeFileSync(join(tmpDir, ".vars.key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars.key\n");

    const checks = runDoctorChecks(tmpDir);
    const warn = checks.find((c) => c.name === "encryption");
    expect(warn?.status).toBe("warn");
  });
});
