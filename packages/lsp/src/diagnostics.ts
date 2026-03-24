import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import { evaluateSchema } from "@vars/core";
import type { VariableDecl } from "@vars/core";
import { parseDocument, getAllVariables } from "./patterns.js";

/**
 * Compute all diagnostics for a .vars document.
 * Uses the v2 core parser which returns structured errors/warnings.
 */
export function computeDiagnostics(text: string, uri: string): Diagnostic[] {
  const result = parseDocument(text, uri);
  const diagnostics: Diagnostic[] = [];

  // Map parse errors to LSP diagnostics
  for (const error of result.errors) {
    const lineIndex = error.line - 1; // AST uses 1-indexed
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: lineIndex, character: 0 },
        end: { line: lineIndex, character: 999 },
      },
      message: error.message,
      source: "vars",
    });
  }

  // Map parse warnings to LSP diagnostics
  for (const warning of result.warnings) {
    const lineIndex = warning.line - 1;
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range: {
        start: { line: lineIndex, character: 0 },
        end: { line: lineIndex, character: 999 },
      },
      message: warning.message,
      source: "vars",
    });
  }

  // Check metadata warnings (expired, deprecated)
  for (const v of getAllVariables(result.ast)) {
    if (v.metadata?.expires) {
      const expiry = new Date(v.metadata.expires);
      if (expiry < new Date()) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: v.line - 1, character: 0 },
            end: { line: v.line - 1, character: 999 },
          },
          message: `${v.name} expired on ${v.metadata.expires}`,
          source: "vars",
        });
      }
    }

    if (v.metadata?.deprecated) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: v.line - 1, character: 0 },
          end: { line: v.line - 1, character: 999 },
        },
        message: `${v.name} is deprecated: ${v.metadata.deprecated}`,
        source: "vars",
      });
    }

    // Validate default values against schema for public/unlocked vars
    if (v.schema) {
      validateVariableDefaults(v, diagnostics);
    }
  }

  return diagnostics;
}

/**
 * Validate that literal default values match their declared Zod schema.
 * Skips encrypted, interpolated, and conditional values.
 */
function validateVariableDefaults(v: VariableDecl, diagnostics: Diagnostic[]): void {
  if (!v.schema || !v.value) return;

  if (v.value.kind === "literal") {
    validateLiteral(v.name, v.schema, v.value.value, v.value.line, diagnostics);
  } else if (v.value.kind === "env_block") {
    for (const entry of v.value.entries) {
      if (entry.value.kind === "literal") {
        validateLiteral(v.name, v.schema, entry.value.value, entry.value.line, diagnostics);
      }
      // Skip encrypted, interpolated, conditional entries
    }
  }
}

function validateLiteral(
  name: string,
  schema: string,
  value: unknown,
  line: number,
  diagnostics: Diagnostic[],
): void {
  try {
    // Use evaluateSchema + safeParse directly (not validateValue) because
    // validateValue coerces strings for env-var runtime. In .vars files the
    // parser already produces typed literals, so a string assigned to
    // z.boolean() should be an error, not silently coerced.
    const zodSchema = evaluateSchema(schema);
    const result = zodSchema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join("; ");
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: line - 1, character: 0 },
          end: { line: line - 1, character: 999 },
        },
        message: `${name}: default value does not match schema ${schema} — ${issues}`,
        source: "vars",
      });
    }
  } catch {
    // Schema evaluation failed — already caught by other diagnostics
  }
}
