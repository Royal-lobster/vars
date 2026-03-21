import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse, isEncrypted } from "@vars/core";
import { findVarsFile } from "../utils/context.js";
import * as output from "../utils/output.js";
import pc from "picocolors";

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
    const checks = runDoctorChecks(cwd);

    output.heading("vars doctor");
    console.log("");

    for (const check of checks) {
      const icon =
        check.status === "pass"
          ? pc.green("\u2713")
          : check.status === "warn"
            ? pc.yellow("\u26a0")
            : pc.red("\u2717");
      console.log(`  ${icon} ${pc.bold(check.label)}: ${check.message}`);
    }

    const failures = checks.filter((c) => c.status === "fail");
    const warnings = checks.filter((c) => c.status === "warn");

    console.log("");
    if (failures.length === 0 && warnings.length === 0) {
      output.success("All checks passed!");
    } else if (failures.length === 0) {
      output.warn(`${warnings.length} warning(s)`);
    } else {
      output.error(`${failures.length} issue(s) found`);
      process.exit(1);
    }
  },
});

/**
 * Run all doctor checks and return results.
 */
export function runDoctorChecks(cwd: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  const varsPath = findVarsFile(cwd) ?? join(cwd, ".vars");
  if (existsSync(varsPath)) {
    checks.push({
      name: "vars-file",
      label: ".vars file",
      status: "pass",
      message: "Found",
    });
  } else {
    checks.push({
      name: "vars-file",
      label: ".vars file",
      status: "fail",
      message: "Not found. Run 'vars init' to create one.",
    });
    return checks;
  }

  const varsDir = dirname(varsPath);
  const keyPath = join(varsDir, "varskey");
  if (existsSync(keyPath)) {
    checks.push({
      name: "key-file",
      label: "varskey file",
      status: "pass",
      message: "Found",
    });
  } else {
    checks.push({
      name: "key-file",
      label: "varskey file",
      status: "fail",
      message: "Not found. Run 'vars init' to generate a key.",
    });
  }

  const gitignorePath = join(varsDir, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf8");
    if (gitignore.includes("varskey")) {
      checks.push({
        name: "gitignore",
        label: ".gitignore",
        status: "pass",
        message: "varskey is gitignored",
      });
    } else {
      checks.push({
        name: "gitignore",
        label: ".gitignore",
        status: "warn",
        message: "varskey is NOT in .gitignore",
      });
    }
  } else {
    checks.push({
      name: "gitignore",
      label: ".gitignore",
      status: "warn",
      message: "No .gitignore found. Create one with varskey entry.",
    });
  }

  const content = readFileSync(varsPath, "utf8");
  try {
    const parsed = parse(content, varsPath);
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

    if (hasPlaintext && !hasEncrypted) {
      checks.push({
        name: "encryption",
        label: "Encryption",
        status: "warn",
        message: "File contains plaintext values. Run 'vars hide' to encrypt.",
      });
    } else if (hasPlaintext && hasEncrypted) {
      checks.push({
        name: "encryption",
        label: "Encryption",
        status: "warn",
        message: "File has a mix of encrypted and plaintext values. Run 'vars hide'.",
      });
    } else if (hasEncrypted) {
      checks.push({
        name: "encryption",
        label: "Encryption",
        status: "pass",
        message: "All values are encrypted",
      });
    } else {
      checks.push({
        name: "encryption",
        label: "Encryption",
        status: "pass",
        message: "No values to encrypt",
      });
    }

    const now = new Date();
    for (const v of parsed.variables) {
      if (v.metadata.expires) {
        const expiry = new Date(v.metadata.expires);
        const daysLeft = Math.floor(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysLeft < 0) {
          checks.push({
            name: `expiry-${v.name}`,
            label: `${v.name} expiry`,
            status: "warn",
            message: `Expired ${Math.abs(daysLeft)} days ago (${v.metadata.expires})`,
          });
        } else if (daysLeft <= 30) {
          checks.push({
            name: `expiry-${v.name}`,
            label: `${v.name} expiry`,
            status: "warn",
            message: `Expires in ${daysLeft} days (${v.metadata.expires})`,
          });
        }
      }
    }
  } catch (err) {
    checks.push({
      name: "parse",
      label: "File syntax",
      status: "fail",
      message: `Parse error: ${(err as Error).message}`,
    });
  }

  return checks;
}
