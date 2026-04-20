import { existsSync } from "node:fs";
import { join } from "node:path";

export const HOOK_MARKER = "# vars: check for unlocked/local/key files";

/** Legacy markers, kept so `vars doctor` can report "outdated" instead of "missing". */
export const OLD_HOOK_MARKERS = ["# vars: check for unlocked files", "@vars-state"];

export const HOOK_SCRIPT = `\n${HOOK_MARKER}\nif git diff --cached --name-only 2>/dev/null | grep -qE '\\.(unlocked|local)\\.vars$'; then\n  echo ""\n  echo "vars: Unlocked or local .vars files cannot be committed."\n  echo "  Run 'vars hide' to encrypt unlocked files."\n  echo "  Remove local override files from staging with 'git reset <file>'."\n  echo ""\n  exit 1\nfi\nif git diff --cached --name-only 2>/dev/null | grep -qE '(^|/)\\.varskey$'; then\n  echo ""\n  echo "vars: .varskey contains your encryption key and must not be committed."\n  echo "  Run 'git reset .varskey' to unstage it."\n  echo ""\n  exit 1\nfi\n`;

/** Resolve the pre-commit hook file path at the given git root.
 *  Prefers .husky/pre-commit if .husky exists, else .git/hooks/pre-commit. */
export function resolveHookPath(gitRoot: string): string {
	const huskyDir = join(gitRoot, ".husky");
	return existsSync(huskyDir)
		? join(huskyDir, "pre-commit")
		: join(gitRoot, ".git", "hooks", "pre-commit");
}
