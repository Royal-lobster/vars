import { defineCommand } from "citty";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import * as output from "../utils/output.js";

const HOOK_MARKER = "# vars: auto-encrypt before commit";
const HOOK_SCRIPT = `
${HOOK_MARKER}
# Block commit if .vars/unlocked.vars exists (secrets are decrypted)
if [ -f .vars/unlocked.vars ]; then
  echo "vars: .vars/unlocked.vars exists — secrets are decrypted!"
  echo "Run 'vars hide' before committing."
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
    throw new Error(
      "No .git/hooks or .husky directory found. Initialize a git repo first.",
    );
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
