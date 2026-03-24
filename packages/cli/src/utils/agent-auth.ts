import { execSync } from "node:child_process";
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
  // Use osascript to show a native macOS dialog with:
  // - The command being requested (so human can review)
  // - A masked password field for the PIN
  const script = `
    set dialogResult to display dialog ¬
      "An AI agent is requesting access to encrypted vars." & return & return & ¬
      "Command:" & return & "  ${escapeAppleScript(command)}" & return & return & ¬
      "Enter your PIN to approve this single operation:" ¬
      with title "vars — approve command" ¬
      default answer "" ¬
      with hidden answer ¬
      buttons {"Deny", "Approve"} ¬
      default button "Approve" ¬
      cancel button "Deny" ¬
      with icon caution
    return text returned of dialogResult
  `;

  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: "utf8",
      timeout: 120_000, // 2 minute timeout
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
  // Try zenity (GTK) first, then kdialog (KDE)
  const message = `An AI agent is requesting access to encrypted vars.\n\nCommand:\n  ${command}\n\nEnter your PIN to approve:`;

  // Try zenity
  try {
    const result = execSync(
      `zenity --password --title="vars — approve command" 2>/dev/null`,
      { encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    return result.trim() || null;
  } catch {
    // zenity not available or cancelled
  }

  // Try kdialog
  try {
    const result = execSync(
      `kdialog --password "${message.replace(/"/g, '\\"')}" --title "vars — approve command" 2>/dev/null`,
      { encoding: "utf8", timeout: 120_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    return result.trim() || null;
  } catch {
    // kdialog not available or cancelled
  }

  return null;
}

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
