import { consola } from "consola";
import pc from "picocolors";

export function success(message: string): void {
  consola.success(message);
}

export function info(message: string): void {
  consola.info(message);
}

export function warn(message: string): void {
  consola.warn(message);
}

export function error(message: string): void {
  consola.error(message);
}

export function heading(title: string): void {
  console.log(`\n${pc.bold(pc.cyan(title))}`);
}

export function table(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => (r[k] ?? "").length)),
  );

  // Header
  const header = keys.map((k, i) => pc.bold(k.padEnd(widths[i]))).join("  ");
  console.log(`  ${header}`);
  console.log(`  ${widths.map((w) => "\u2500".repeat(w)).join("  ")}`);

  // Rows
  for (const row of rows) {
    const line = keys.map((k, i) => (row[k] ?? "").padEnd(widths[i])).join("  ");
    console.log(`  ${line}`);
  }
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
  console.log(
    `\n${pc.red("\u2717")} vars check failed (${errors.length} error${errors.length !== 1 ? "s" : ""}${warnings.length > 0 ? `, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}` : ""})`,
  );
  console.log("");

  for (const err of errors) {
    const envLabel = err.env ? ` (${pc.yellow(`@${err.env}`)})` : "";
    console.log(`  ${pc.bold(err.variable)}${envLabel}:`);
    if (err.expected) {
      console.log(`    Expected: ${pc.dim(err.expected)}`);
    }
    if (err.got) {
      console.log(`    Got: ${pc.dim(err.got)}`);
    }
    console.log(`    ${pc.dim("\u2192")} ${err.message}`);
    console.log("");
  }

  for (const w of warnings) {
    console.log(`  ${pc.yellow("\u26a0")} ${pc.bold(w.variable)}:`);
    console.log(`    ${w.message}`);
    if (w.detail) {
      console.log(`    ${pc.dim("\u2192")} ${w.detail}`);
    }
    console.log("");
  }
}
