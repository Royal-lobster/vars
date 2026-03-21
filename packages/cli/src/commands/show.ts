import { defineCommand } from "citty";
import { existsSync, readFileSync, renameSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { decrypt, isEncrypted, regenerateIfStale } from "@vars/core";
import { buildContext, requireKey } from "../utils/context.js";
import { ENV_VALUE_LINE, ENV_VALUE_LINE_VALUE_ONLY, HOOK_MARKER, countVariables } from "../utils/patterns.js";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import * as output from "../utils/output.js";
import * as clack from "@clack/prompts";

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

    // Check if vault has any encrypted values — skip key if none
    const hasEncrypted = vaultHasEncryptedValues(ctx.varsFilePath);
    const key = hasEncrypted ? await requireKey(ctx) : null;

    // Count variables before decryption
    const varCount = countVariables(ctx.varsFilePath);

    // Run safety checks before decrypting
    const projectRoot = findProjectRoot(dirname(ctx.varsFilePath));
    buildSafetyChecks(projectRoot);

    showVarsFile(ctx.varsFilePath, key);

    output.outro(`Unlocked ${varCount} variable${varCount !== 1 ? "s" : ""}. Edit .vars/unlocked.vars, then run vars hide.`);
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
 * Ensure .gitignore has vars entries. Auto-adds them if missing.
 */
function ensureGitignore(projectRoot: string): void {
  const gitignorePath = join(projectRoot, ".gitignore");
  const varsEntries = [
    "",
    "# vars",
    ".vars/key",
    ".vars/key.*",
    ".vars/unlocked.vars",
    ".env",
    ".env.*",
  ].join("\n");

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, "utf8");
    if (!existing.includes("unlocked.vars")) {
      appendFileSync(gitignorePath, "\n" + varsEntries + "\n");
    }
  } else {
    writeFileSync(gitignorePath, varsEntries + "\n");
  }
}

/**
 * Build safety checks for the show command.
 * Auto-fixes gitignore if missing, then reports remaining issues.
 */
export function buildSafetyChecks(projectRoot: string): output.SafetyCheck[] {
  const checks: output.SafetyCheck[] = [];

  // Check 1: Ensure unlocked.vars is in .gitignore (auto-fix)
  ensureGitignore(projectRoot);
  checks.push({ label: "unlocked.vars is gitignored", status: "pass" });

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
          status: "warn",
          fix: "Run vars hook to install the pre-commit hook",
        },
  );

  return checks;
}

/**
 * Check whether a vault file contains any encrypted values.
 */
export function vaultHasEncryptedValues(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf8");
  return content.split("\n").some((line) => {
    const match = line.match(ENV_VALUE_LINE_VALUE_ONLY);
    return match && isEncrypted(match[1].trim());
  });
}

/**
 * Decrypt all encrypted values in .vars, write decrypted content,
 * then rename .vars → .vars.unlocked.
 * This is a simple rename so the editor follows the file.
 */
export function showVarsFile(filePath: string, key: Buffer | null): string {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(ENV_VALUE_LINE);
    if (match) {
      const prefix = match[1];
      const value = match[2].trim();
      if (isEncrypted(value)) {
        if (!key) {
          throw new Error(
            "Encrypted values found but no key available.\nRun 'vars init' to create a key, or set VARS_KEY env var.",
          );
        }
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
