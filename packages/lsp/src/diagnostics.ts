import { type Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
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
  }

  return diagnostics;
}
