import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { initProject } from "../commands/init.js";
import { showVarsFile } from "../commands/show.js";
import { hideVarsFile } from "../commands/hide.js";
import { checkVarsFile } from "../commands/check.js";
import { buildRunEnv } from "../commands/run.js";
import { generateFromFile } from "../commands/gen.js";
import { listVariables } from "../commands/ls.js";
import { getStatus } from "../commands/status.js";
import { calculateCoverage } from "../commands/coverage.js";
import { generateTemplate } from "../commands/template.js";

describe("CLI integration: full workflow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vars-integration-"));
  });

  it("init -> show -> edit -> hide -> check -> run -> gen", async () => {
    // 1. Create a .env to migrate from
    writeFileSync(
      join(tmpDir, ".env"),
      [
        "DATABASE_URL=postgres://localhost:5432/myapp",
        "PORT=3000",
        "DEBUG=true",
      ].join("\n"),
    );

    // 2. Init project
    await initProject({ cwd: tmpDir, pin: "1234", env: "dev", interactive: false });
    expect(existsSync(join(tmpDir, ".vars"))).toBe(true);
    expect(existsSync(join(tmpDir, ".vars.key"))).toBe(true);

    // 3. Verify encrypted
    const varsContent = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(varsContent).toContain("DATABASE_URL");
    expect(varsContent).toContain("enc:v1:aes256gcm:");

    // 4. Decrypt the key to get master key for testing
    const keyContent = readFileSync(join(tmpDir, ".vars.key"), "utf8").trim();
    const { decryptMasterKey } = await import("@vars/core");
    const masterKey = await decryptMasterKey(keyContent, "1234");

    // 5. Show (decrypt in-place)
    showVarsFile(join(tmpDir, ".vars"), masterKey);
    const shown = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(shown).toContain("postgres://localhost:5432/myapp");
    expect(shown).not.toContain("enc:v1:aes256gcm:");

    // 6. Check (should pass)
    const checkResult = checkVarsFile(join(tmpDir, ".vars"), "dev");
    expect(checkResult.valid).toBe(true);

    // 7. Hide (re-encrypt)
    hideVarsFile(join(tmpDir, ".vars"), masterKey);
    const hidden = readFileSync(join(tmpDir, ".vars"), "utf8");
    expect(hidden).toContain("enc:v1:aes256gcm:");
    expect(hidden).not.toContain("postgres://localhost:5432/myapp");

    // 8. Run env
    const env = buildRunEnv(join(tmpDir, ".vars"), "dev", masterKey);
    expect(env.DATABASE_URL).toBe("postgres://localhost:5432/myapp");
    expect(env.PORT).toBe("3000");

    // 9. Gen
    const genPath = join(tmpDir, "env.generated.ts");
    generateFromFile(join(tmpDir, ".vars"), genPath);
    const generated = readFileSync(genPath, "utf8");
    expect(generated).toContain("DATABASE_URL");
    expect(generated).toContain("PORT");

    // 10. Status
    const status = getStatus(join(tmpDir, ".vars"));
    expect(status.encryptionState).toBe("encrypted");
    expect(status.variableCount).toBe(3);

    // 11. Coverage
    const coverage = calculateCoverage(join(tmpDir, ".vars"), "dev");
    expect(coverage.percentage).toBe(100);

    // 12. Ls
    const list = listVariables(join(tmpDir, ".vars"));
    expect(list.length).toBe(3);

    // 13. Template
    const template = generateTemplate(join(tmpDir, ".vars"), "dev", masterKey);
    expect(template).toContain("DATABASE_URL=postgres://localhost:5432/myapp");
    expect(template).toContain("PORT=3000");
  });
});
