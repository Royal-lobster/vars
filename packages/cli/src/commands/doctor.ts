import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, isEncrypted } from "@vars/core";
import { findVarsFile } from "../utils/context.js";
import { HOOK_MARKER } from "../utils/patterns.js";
import * as output from "../utils/output.js";
import type { HealthCheckGroup } from "../utils/output.js";

// Kept for backwards compatibility
export interface DoctorCheck {
  name: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export default defineCommand({
  meta: {
    name: "doctor",
    description: "Check for common issues (missing key, stale vars, expiring secrets)",
  },
  async run() {
    const cwd = process.cwd();

    output.intro("doctor");
    output.info("Checking your vars setup...");

    const groups = runDoctorChecks(cwd);

    output.healthCheck(groups);

    const allChecks = groups.flatMap((g) => g.checks);
    const passed = allChecks.filter((c) => c.status === "pass").length;
    const warnings = allChecks.filter((c) => c.status === "warn").length;
    const failures = allChecks.filter((c) => c.status === "fail").length;

    if (warnings === 0 && failures === 0) {
      output.outro("All checks passed!");
    } else {
      const parts: string[] = [`${passed} passed`];
      if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? "s" : ""}`);
      if (failures > 0) parts.push(`${failures} failure${failures !== 1 ? "s" : ""}`);
      output.outro(parts.join(" · "));
      if (failures > 0) {
        process.exit(1);
      }
    }
  },
});

/**
 * Run all doctor checks grouped by category and return results.
 */
export function runDoctorChecks(cwd: string): HealthCheckGroup[] {
  const varsPath = findVarsFile(cwd) ?? join(cwd, ".vars", "vault.vars");
  const varsExists = existsSync(varsPath);
  const varsDir = dirname(varsPath);

  // Determine project root (.vars/ is one level below root)
  const projectRoot = dirname(varsDir);

  // ── Files group ─────────────────────────────────────────────────────
  const filesChecks: HealthCheckGroup["checks"] = [];

  if (varsExists) {
    filesChecks.push({
      label: ".vars/vault.vars found",
      status: "pass",
      message: "",
    });
  } else {
    filesChecks.push({
      label: ".vars/vault.vars found",
      status: "fail",
      message: "Not found",
      suggestion: "Run vars init to create one",
    });
    // Return early — remaining checks are meaningless without the vault
    return [
      { name: "Files", checks: filesChecks },
      { name: "Security", checks: [] },
      { name: "Secrets Health", checks: [] },
    ];
  }

  const keyPath = join(varsDir, "key");
  if (existsSync(keyPath)) {
    filesChecks.push({
      label: ".vars/key found",
      status: "pass",
      message: "",
    });
  } else {
    filesChecks.push({
      label: ".vars/key found",
      status: "fail",
      message: "Not found",
      suggestion: "Run vars init to generate a key",
    });
  }

  const generatedPath = join(projectRoot, "vars.generated.ts");
  if (existsSync(generatedPath)) {
    filesChecks.push({
      label: "vars.generated.ts up to date",
      status: "pass",
      message: "",
    });
  } else {
    filesChecks.push({
      label: "vars.generated.ts up to date",
      status: "warn",
      message: "File not found",
      suggestion: "Run vars show to regenerate vars.generated.ts",
    });
  }

  // ── Security group ───────────────────────────────────────────────────
  const securityChecks: HealthCheckGroup["checks"] = [];

  const rootGitignorePath = join(projectRoot, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(rootGitignorePath)) {
    gitignoreContent = readFileSync(rootGitignorePath, "utf8");
  }

  // Key gitignored
  if (
    gitignoreContent.includes(".vars/key") ||
    gitignoreContent.includes("*.key") ||
    gitignoreContent.includes(".vars/")
  ) {
    securityChecks.push({
      label: ".vars/key is gitignored",
      status: "pass",
      message: "",
    });
  } else {
    securityChecks.push({
      label: ".vars/key is gitignored",
      status: "warn",
      message: "Not in .gitignore",
      suggestion: "Add .vars/key to .gitignore",
    });
  }

  // unlocked.vars gitignored
  if (
    gitignoreContent.includes("unlocked.vars") ||
    gitignoreContent.includes(".vars/")
  ) {
    securityChecks.push({
      label: ".vars/unlocked.vars is gitignored",
      status: "pass",
      message: "",
    });
  } else {
    securityChecks.push({
      label: ".vars/unlocked.vars is gitignored",
      status: "warn",
      message: "Not in .gitignore",
      suggestion: "Add .vars/unlocked.vars to .gitignore",
    });
  }

  // Pre-commit hook installed
  const hookMarker = HOOK_MARKER;
  const huskyHookPath = join(projectRoot, ".husky", "pre-commit");
  const gitHookPath = join(projectRoot, ".git", "hooks", "pre-commit");
  const huskyContent = existsSync(huskyHookPath)
    ? readFileSync(huskyHookPath, "utf8")
    : "";
  const gitHookContent = existsSync(gitHookPath)
    ? readFileSync(gitHookPath, "utf8")
    : "";

  if (huskyContent.includes(hookMarker) || gitHookContent.includes(hookMarker)) {
    securityChecks.push({
      label: "Pre-commit hook installed",
      status: "pass",
      message: "",
    });
  } else {
    securityChecks.push({
      label: "Pre-commit hook installed",
      status: "warn",
      message: "Not installed",
      suggestion: "Run vars hook to install",
    });
  }

  // Encryption check
  let encryptionStatus: "pass" | "warn" | "fail" = "pass";
  let encryptionLabel = "All values encrypted";
  let encryptionSuggestion: string | undefined;
  let parsedOk = true;
  let parsedVariables: ReturnType<typeof parse>["variables"] = [];

  try {
    const content = readFileSync(varsPath, "utf8");
    const parsed = parse(content, varsPath);
    parsedVariables = parsed.variables;

    let hasPlaintext = false;
    let hasEncrypted = false;

    for (const v of parsed.variables) {
      for (const val of v.values) {
        if (isEncrypted(val.value)) {
          hasEncrypted = true;
        } else {
          hasPlaintext = true;
        }
      }
    }

    if (hasPlaintext) {
      encryptionStatus = "warn";
      encryptionLabel = "All values encrypted";
      encryptionSuggestion = "Run vars hide to encrypt plaintext values";
    } else {
      encryptionStatus = "pass";
      encryptionLabel = "All values encrypted";
    }
  } catch (err) {
    parsedOk = false;
    encryptionStatus = "fail";
    encryptionLabel = "File syntax error";
    encryptionSuggestion = (err as Error).message;
  }

  securityChecks.push({
    label: encryptionLabel,
    status: encryptionStatus,
    message: encryptionStatus === "fail" ? encryptionSuggestion ?? "" : "",
    suggestion: encryptionStatus !== "pass" ? encryptionSuggestion : undefined,
  });

  // ── Secrets Health group ─────────────────────────────────────────────
  const secretsChecks: HealthCheckGroup["checks"] = [];

  if (parsedOk && parsedVariables.length > 0) {
    const now = new Date();
    let anyIssue = false;

    for (const v of parsedVariables) {
      if (v.metadata.expires) {
        const expiry = new Date(v.metadata.expires);
        const daysLeft = Math.floor(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysLeft < 0) {
          anyIssue = true;
          secretsChecks.push({
            label: `${v.name} expired ${Math.abs(daysLeft)} days ago (${v.metadata.expires})`,
            status: "warn",
            message: "",
            suggestion: `Remove or update ${v.name}`,
          });
        } else if (daysLeft <= 30) {
          anyIssue = true;
          secretsChecks.push({
            label: `${v.name} expires in ${daysLeft} days (${v.metadata.expires})`,
            status: "warn",
            message: "",
            suggestion: `Rotate ${v.name} before it expires`,
          });
        }
      }
    }

    if (!anyIssue) {
      secretsChecks.push({
        label: "No expiring or deprecated secrets",
        status: "pass",
        message: "",
      });
    }
  } else if (parsedOk) {
    secretsChecks.push({
      label: "No expiring or deprecated secrets",
      status: "pass",
      message: "",
    });
  }

  return [
    { name: "Files", checks: filesChecks },
    { name: "Security", checks: securityChecks },
    { name: "Secrets Health", checks: secretsChecks },
  ];
}
