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
# Re-encrypt any plaintext values in .vars before committing
if [ -f .vars ]; then
  if command -v vars >/dev/null 2>&1; then
    vars hide 2>/dev/null
    if [ $? -ne 0 ]; then
      echo "vars: failed to encrypt .vars — commit blocked"
      echo "Run 'vars unlock' first, then try again"
      exit 1
    fi
    git add .vars
  else
    echo "vars: CLI not found — skipping auto-encryption"
    echo "Install with: npm install -g @vars/cli"
  fi
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
        const cwd = process.cwd();
        installHook(cwd);
        output.success("Pre-commit hook installed. .vars will be auto-encrypted before commits.");
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
