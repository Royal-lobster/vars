import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { runDoctorChecks } from "../../commands/doctor.js";
import type { HealthCheckGroup } from "../../utils/output.js";

// Helper to find a check by label substring across all groups
function findCheck(groups: HealthCheckGroup[], labelSubstring: string) {
  for (const group of groups) {
    for (const check of group.checks) {
      if (check.label.includes(labelSubstring)) return check;
    }
  }
  return undefined;
}

describe("vars doctor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-doctor-test-"));
  });

  it("warns when stale .env files exist in project root", () => {
    // Create .vars directory structure
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    // Create stale .env file
    writeFileSync(join(tmpDir, ".env"), "PORT=3000\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, ".env");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("warn");
  });

  it("warns when stale .env.local files exist", () => {
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    writeFileSync(join(tmpDir, ".env.local"), "SECRET=abc\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, ".env");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("warn");
  });

  it("passes when no .env files exist", () => {
    const varsDir = join(tmpDir, ".vars");
    mkdirSync(varsDir);
    writeFileSync(join(varsDir, "vault.vars"), "PORT  z.coerce.number()\n  @default = 3000\n");
    writeFileSync(join(varsDir, "key"), "pin:v1:aes256gcm:salt:iv:ct:tag");
    writeFileSync(join(tmpDir, ".gitignore"), ".vars/key\n.vars/unlocked.vars\n");

    const groups = runDoctorChecks(tmpDir);
    const envCheck = findCheck(groups, "No stale .env files");
    expect(envCheck).toBeDefined();
    expect(envCheck!.status).toBe("pass");
  });
});
