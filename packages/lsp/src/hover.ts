import { parseDocument, findVariableAtLine } from "./patterns.js";

export interface HoverContext {
  text: string;
  line: number;
  character: number;
  uri: string;
}

export interface HoverResult {
  contents: string;
  range?: { startLine: number; startChar: number; endLine: number; endChar: number };
}

/**
 * Compute hover information for a position in a .vars document.
 * Uses the v2 AST to find the variable at the cursor line.
 */
export function computeHover(ctx: HoverContext): HoverResult | null {
  const result = parseDocument(ctx.text);
  const variable = findVariableAtLine(result.ast, ctx.line + 1); // AST uses 1-indexed
  if (!variable) return null;

  const parts: string[] = [];
  parts.push(`**\`${variable.name}\`**`);

  if (variable.schema) {
    parts.push(`Schema: \`${variable.schema}\``);
  }

  parts.push(variable.public ? "Visibility: public" : "Visibility: secret (Redacted)");

  if (variable.metadata) {
    if (variable.metadata.description) {
      parts.push(`**Description:** ${variable.metadata.description}`);
    }
    if (variable.metadata.owner) {
      parts.push(`**Owner:** ${variable.metadata.owner}`);
    }
    if (variable.metadata.expires) {
      parts.push(`**Expires:** ${variable.metadata.expires}`);
    }
    if (variable.metadata.deprecated) {
      parts.push(`**Deprecated:** ${variable.metadata.deprecated}`);
    }
    if (variable.metadata.tags && variable.metadata.tags.length > 0) {
      parts.push(`**Tags:** ${variable.metadata.tags.join(", ")}`);
    }
  }

  return {
    contents: parts.join("\n\n"),
    range: {
      startLine: ctx.line,
      startChar: 0,
      endLine: ctx.line,
      endChar: variable.name.length,
    },
  };
}
