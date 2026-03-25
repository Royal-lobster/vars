import { execFileSync } from "node:child_process";
import { platform } from "node:os";

/**
 * Request PIN approval via a system dialog when running in a non-interactive
 * terminal (e.g., inside an AI coding agent like Claude Code or Cursor).
 *
 * Shows the exact command being executed so the human can review before
 * entering their PIN. Each command requires a separate approval — no sessions.
 *
 * Returns the PIN string, or null if the user cancelled.
 */
export function requestAgentApproval(command: string): string | null {
	const os = platform();

	if (os === "darwin") {
		return requestApprovalMacOS(command);
	}

	if (os === "linux") {
		return requestApprovalLinux(command);
	}

	// Unsupported platform — can't show a dialog
	return null;
}

function requestApprovalMacOS(command: string): string | null {
	// AppleScript has no backslash escape for double quotes inside string literals.
	// Use concatenation with the `quote` constant to safely embed arbitrary strings.
	const safeCommand = command.replace(/\\/g, "\\\\").split('"').join('" & quote & "');

	const script = [
		"set dialogResult to display dialog",
		'"An AI agent is requesting access to encrypted vars." & return & return &',
		`"Command:" & return & "  ${safeCommand}" & return & return &`,
		'"Enter your PIN to approve this single operation:"',
		'with title "vars — approve command"',
		'default answer ""',
		"with hidden answer",
		'buttons {"Deny", "Approve"}',
		'default button "Approve"',
		'cancel button "Deny"',
		"with icon caution",
		"return text returned of dialogResult",
	].join(" ¬\n");

	try {
		const result = execFileSync("osascript", ["-e", script], {
			encoding: "utf8",
			timeout: 120_000,
			stdio: ["pipe", "pipe", "pipe"],
		});
		const pin = result.trim();
		return pin || null;
	} catch {
		// User clicked "Deny" or closed the dialog
		return null;
	}
}

function requestApprovalLinux(command: string): string | null {
	const message = `An AI agent is requesting access to encrypted vars.\n\nCommand:\n  ${command}\n\nEnter your PIN to approve:`;

	// Try zenity (GTK)
	try {
		const result = execFileSync(
			"zenity",
			["--password", "--title=vars — approve command", `--text=${message}`],
			{ encoding: "utf8", timeout: 120_000 },
		);
		return result.trim() || null;
	} catch {
		// zenity not available or cancelled
	}

	// Try kdialog (KDE)
	try {
		const result = execFileSync(
			"kdialog",
			["--password", message, "--title", "vars — approve command"],
			{ encoding: "utf8", timeout: 120_000 },
		);
		return result.trim() || null;
	} catch {
		// kdialog not available or cancelled
	}

	return null;
}
