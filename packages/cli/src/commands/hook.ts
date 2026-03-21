import { defineCommand } from "citty";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import * as output from "../utils/output.js";
import { HOOK_MARKER } from "../utils/patterns.js";
const HOOK_SCRIPT = `
${HOOK_MARKER}
# Block commit if secrets are decrypted
if [ -f .vars/unlocked.vars ]; then
  echo ""
  echo "\u26a0 vars: secrets are currently decrypted (.vars/unlocked.vars exists)"
  echo "  Run 'vars hide' to re-encrypt before committing."
  echo ""
  exit 1
fi
`;

export default defineCommand({
  meta: {
    name: "hook",
    description: "Install git pre-commit hook for auto-encryption",
  },
  subCommands: {
    install: defineCommand({
      meta: {
        name: "install",
        description: "Install the pre-commit hook",
      },
      async run() {
        output.intro("hook");
        const cwd = process.cwd();
        installHook(cwd);
        output.outro("Pre-commit hook installed.");
      },
    }),
  },
});

/**
 * Install the vars pre-commit hook.
 */
export function installHook(cwd: string): void {
  const huskyDir = join(cwd, ".husky");
  const gitHooksDir = join(cwd, ".git", "hooks");

  let hookPath: string;
  if (existsSync(huskyDir)) {
    hookPath = join(huskyDir, "pre-commit");
  } else if (existsSync(gitHooksDir)) {
    hookPath = join(gitHooksDir, "pre-commit");
  } else {
    // Auto-init git repo if none exists, then use .git/hooks
    try {
      execSync("git init", { cwd, stdio: "ignore" });
    } catch {
      throw new Error(
        "No .git/hooks or .husky directory found and could not initialize git.",
      );
    }
    mkdirSync(join(cwd, ".git", "hooks"), { recursive: true });
    hookPath = join(cwd, ".git", "hooks", "pre-commit");
  }

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (existing.includes(HOOK_MARKER)) {
      return;
    }
    writeFileSync(hookPath, existing.trimEnd() + "\n" + HOOK_SCRIPT + "\n");
  } else {
    writeFileSync(hookPath, "#!/bin/sh\n" + HOOK_SCRIPT + "\n");
  }

  chmodSync(hookPath, 0o755);
}
