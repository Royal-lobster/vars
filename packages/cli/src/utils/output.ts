import * as clack from "@clack/prompts";
import pc from "picocolors";

// ── Interfaces ──────────────────────────────────────────────────────

export interface FileTreeEntry {
  path: string;
  description: string;
  indent?: number;
}

export interface SafetyCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  fix?: string;
}

export interface HealthCheckGroup {
  name: string;
  checks: Array<{
    label: string;
    status: "pass" | "warn" | "fail";
    message: string;
    suggestion?: string;
  }>;
}

// ── Helpers ─────────────────────────────────────────────────────────

function statusIcon(status: "pass" | "warn" | "fail"): string {
  switch (status) {
    case "pass":
      return pc.green("\u2713");
    case "warn":
      return pc.yellow("\u26a0");
    case "fail":
      return pc.red("\u2717");
  }
}

// ── Core logging ────────────────────────────────────────────────────

export function intro(command: string): void {
  clack.intro(`${pc.bgCyan(pc.black(` vars ${command} `))}`);
}

export function outro(message: string): void {
  clack.outro(message);
}

export function step(message: string): void {
  clack.log.step(message);
}

export function success(message: string): void {
  clack.log.success(message);
}

export function info(message: string): void {
  clack.log.info(message);
}

export function warn(message: string): void {
  clack.log.warn(message);
}

export function error(message: string): void {
  clack.log.error(message);
}

// ── Styled components ───────────────────────────────────────────────

export function heading(title: string): void {
  clack.log.message(`${pc.bold(pc.cyan(title))}`);
}

export function fileTree(root: string, files: FileTreeEntry[]): void {
  const lines: string[] = [pc.bold(root)];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const indent = file.indent ?? 0;
    const isLast = i === files.length - 1;
    const prefix = "  ".repeat(indent) + (isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 ");
    const desc = file.description ? pc.dim(` \u2500 ${file.description}`) : "";
    lines.push(`${prefix}${file.path}${desc}`);
  }
  clack.log.message(lines.join("\n"));
}

export function stateChange(from: string, to: string): void {
  clack.log.message(`${pc.dim(from)} ${pc.dim("\u2192")} ${pc.bold(to)}`);
}

export function nextSteps(items: string[]): void {
  const numbered = items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  clack.note(numbered, "Next steps");
}

export function safetyChecks(checks: SafetyCheck[]): void {
  const lines: string[] = [];
  for (const check of checks) {
    const icon = statusIcon(check.status);
    lines.push(`${icon}  ${check.label}`);
    if (check.status !== "pass" && check.fix) {
      lines.push(`   ${pc.dim(check.fix)}`);
    }
  }
  clack.note(lines.join("\n"), "Safety checks");
}

export function warning(title: string, bullets: string[]): void {
  const body = bullets.map((b) => `  \u2022 ${b}`).join("\n");
  clack.log.warn(`${pc.bold(title)}\n${body}`);
}

export function healthCheck(groups: HealthCheckGroup[]): void {
  const suggestions: string[] = [];

  for (const group of groups) {
    clack.log.message(pc.bold(pc.underline(group.name)));
    for (const check of group.checks) {
      const icon = statusIcon(check.status);
      clack.log.message(`  ${icon}  ${check.label}  ${pc.dim(check.message)}`);
      if (check.status !== "pass" && check.suggestion) {
        suggestions.push(check.suggestion);
      }
    }
  }

  if (suggestions.length > 0) {
    const body = suggestions.map((s) => `\u2022 ${s}`).join("\n");
    clack.note(body, "Suggestions");
  }
}

export function table(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => (r[k] ?? "").length)),
  );

  const header = keys.map((k, i) => pc.bold(k.padEnd(widths[i]))).join("  ");
  const separator = widths.map((w) => "\u2500".repeat(w)).join("  ");
  const dataLines = rows.map((row) =>
    keys.map((k, i) => (row[k] ?? "").padEnd(widths[i])).join("  "),
  );

  clack.log.message(
    [header, separator, ...dataLines].map((l) => `  ${l}`).join("\n"),
  );
}

export function validationErrors(
  errors: Array<{
    variable: string;
    env?: string;
    message: string;
    expected?: string;
    got?: string;
  }>,
  warnings: Array<{
    variable: string;
    message: string;
    detail?: string;
  }> = [],
): void {
  const summary = `${errors.length} error${errors.length !== 1 ? "s" : ""}${
    warnings.length > 0
      ? `, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`
      : ""
  }`;

  clack.log.error(`vars check failed (${summary})`);

  for (const err of errors) {
    const envLabel = err.env ? ` (${pc.yellow(`@${err.env}`)})` : "";
    const lines = [`${pc.bold(err.variable)}${envLabel}:`];
    if (err.expected) {
      lines.push(`  Expected: ${pc.dim(err.expected)}`);
    }
    if (err.got) {
      lines.push(`  Got: ${pc.dim(err.got)}`);
    }
    lines.push(`  ${pc.dim("\u2192")} ${err.message}`);
    clack.log.message(lines.join("\n"));
  }

  for (const w of warnings) {
    const lines = [`${pc.yellow("\u26a0")} ${pc.bold(w.variable)}:`];
    lines.push(`  ${w.message}`);
    if (w.detail) {
      lines.push(`  ${pc.dim("\u2192")} ${w.detail}`);
    }
    clack.log.message(lines.join("\n"));
  }
}
