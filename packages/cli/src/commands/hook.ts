import { defineCommand } from "citty";
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getProjectRoot } from "../utils/context.js";
import pc from "picocolors";

const HOOK_MARKER = "# vars: check for unlocked files";
const HOOK_SCRIPT = `
${HOOK_MARKER}
for f in $(git diff --cached --name-only 2>/dev/null | grep '\\.vars$'); do
  if head -1 "$f" 2>/dev/null | grep -q '@vars-state unlocked'; then
    echo ""
    echo "vars: $f contains decrypted secrets."
    echo "  Run 'vars hide' to encrypt before committing."
    echo ""
    exit 1
  fi
done
`;

export default defineCommand({
  meta: { name: "hook", description: "Install pre-commit hook" },
  args: {},
  async run() {
    const root = getProjectRoot();
    // Try husky first, then raw git hooks
    const huskyPath = join(root, ".husky", "pre-commit");
    const gitHookPath = join(root, ".git", "hooks", "pre-commit");
    const hookPath = existsSync(join(root, ".husky")) ? huskyPath : gitHookPath;

    if (existsSync(hookPath)) {
      const content = readFileSync(hookPath, "utf8");
      if (content.includes(HOOK_MARKER)) {
        console.log(pc.dim("  Hook already installed"));
        return;
      }
      writeFileSync(hookPath, content.trimEnd() + "\n" + HOOK_SCRIPT + "\n");
    } else {
      const dir = join(hookPath, "..");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(hookPath, "#!/bin/sh\n" + HOOK_SCRIPT + "\n");
    }
    chmodSync(hookPath, 0o755);
    console.log(pc.green("  ✓ Pre-commit hook installed"));
  },
});
