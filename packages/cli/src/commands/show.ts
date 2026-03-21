import { defineCommand } from "citty";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { decrypt, isEncrypted, regenerateIfStale } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE, HOOK_MARKER, countVariables } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";
import * as clack from "@clack/prompts";
import pc from "picocolors";

export default defineCommand({
  meta: {
    name: "show",
    description: "Decrypt all values and rename to .vars.unlocked for safe editing",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    output.intro("show");

    const ctx = buildContext({ file: args.file });
    const key = await requireKey(ctx);

    // Count variables before decryption
    const varCount = countVariables(ctx.varsFilePath);

    const s = clack.spinner();
    s.start("Decrypting...");
    const decryptedPath = showVarsFile(ctx.varsFilePath, key);
    s.stop("Decrypted.");

    output.stateChange("vault.vars", "unlocked.vars");

    // Run safety checks and display note box
    const projectRoot = findProjectRoot(dirname(ctx.varsFilePath));
    const checks = buildSafetyChecks(projectRoot);
    const failCount = checks.filter((c) => c.status !== "pass").length;

    if (failCount === 0) {
      clack.note(
        [
          "Edit .vars/unlocked.vars in your editor.",
          "",
          ...checks.map((c) => `${pc.green("\u2713")} ${c.label}`),
          "",
          "Run vars hide when you're done editing.",
        ].join("\n"),
        "Ready to edit",
      );
    } else if (failCount === checks.length) {
      clack.note(
        [
          "Edit .vars/unlocked.vars in your editor.",
          "",
          ...checks.map((c) =>
            c.status === "pass"
              ? `${pc.green("\u2713")} ${c.label}`
              : `${pc.yellow("\u26a0")} ${c.label}${c.fix ? `\n   ${pc.dim(c.fix)}` : ""}`,
          ),
          "",
          pc.yellow("Your decrypted secrets are exposed. Fix the above before continuing."),
        ].join("\n"),
        "Safety checks",
      );
    } else {
      clack.note(
        [
          "Edit .vars/unlocked.vars in your editor.",
          "",
          ...checks.map((c) =>
            c.status === "pass"
              ? `${pc.green("\u2713")} ${c.label}`
              : `${pc.red("\u2717")} ${c.label}${c.fix ? `\n   ${pc.dim(c.fix)}` : ""}`,
          ),
          "",
          "Remember to run vars hide when done \u2014 without the hook, there's no safety net.",
        ].join("\n"),
        "Safety checks",
      );
    }

    output.outro(`Unlocked. ${varCount} variable${varCount !== 1 ? "s" : ""} decrypted.`);
  },
});

/**
 * Walk up from the .vars directory to find the project root (where .git lives).
 */
export function findProjectRoot(startDir: string): string {
  let dir = resolve(startDir);
  const root = resolve("/");
  while (dir !== root) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

/**
 * Build safety checks for the show command.
 * Checks: 1) unlocked.vars in .gitignore  2) pre-commit hook with vars marker
 */
export function buildSafetyChecks(projectRoot: string): output.SafetyCheck[] {
  const checks: output.SafetyCheck[] = [];

  // Check 1: Is unlocked.vars in .gitignore?
  const gitignorePath = join(projectRoot, ".gitignore");
  let gitignoreOk = false;
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, "utf8");
    gitignoreOk = gitignoreContent.includes("unlocked.vars");
  }
  checks.push(
    gitignoreOk
      ? { label: "unlocked.vars is gitignored", status: "pass" }
      : {
          label: "unlocked.vars is not gitignored",
          status: "fail",
          fix: 'Add "unlocked.vars" to .gitignore',
        },
  );

  // Check 2: Does a pre-commit hook with vars marker exist?
  let hookOk = false;
  const huskyPath = join(projectRoot, ".husky", "pre-commit");
  const gitHookPath = join(projectRoot, ".git", "hooks", "pre-commit");
  for (const hookPath of [huskyPath, gitHookPath]) {
    if (existsSync(hookPath)) {
      const hookContent = readFileSync(hookPath, "utf8");
      if (hookContent.includes(HOOK_MARKER)) {
        hookOk = true;
        break;
      }
    }
  }
  checks.push(
    hookOk
      ? { label: "Pre-commit hook active", status: "pass" }
      : {
          label: "Pre-commit hook not found",
          status: "fail",
          fix: "Run vars hook to install the pre-commit hook",
        },
  );

  return checks;
}

/**
 * Decrypt all encrypted values in .vars, write decrypted content,
 * then rename .vars → .vars.unlocked.
 * This is a simple rename so the editor follows the file.
 */
export function showVarsFile(filePath: string, key: Buffer): string {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const prefix = match[1];
      const value = match[2].trim();
      if (isEncrypted(value)) {
        const decrypted = decrypt(value, key);
        result.push(`${prefix}${decrypted}`);
        continue;
      }
    }
    result.push(line);
  }

  // Write decrypted content into .vars, then rename to .vars.unlocked
  atomicWriteFileSync(filePath, result.join("\n"));

  // Regenerate env.generated.ts before rename (while .vars still exists)
  regenerateIfStale(filePath, ".vars");

  const decryptedPath = resolve(dirname(filePath), "unlocked.vars");
  renameSync(filePath, decryptedPath);
  return decryptedPath;
}
