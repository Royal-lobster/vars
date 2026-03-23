export interface HeaderCommentContext {
  source: "env" | "boilerplate";
  publicVarNames: string[];
  totalVarCount: number;
  detectedPrefixes: string[];
}

export function buildHeaderComment(ctx: HeaderCommentContext): string {
  const lines: string[] = ["#"];
  // Short-form for small files: avoids comment-to-content ratio > 1:1
  const isShortForm = ctx.source === "env" && ctx.totalVarCount > 0 && ctx.totalVarCount <= 5;

  if (ctx.source === "boilerplate") {
    lines.push("# Replace the example variables below with your own.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (ctx.source === "env" && ctx.totalVarCount === 0) {
    lines.push("# No variables found in .env — add your own below.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (isShortForm) {
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else {
    // Long-form migration (> 5 vars)
    const hasPublicVars = ctx.detectedPrefixes.length > 0 || ctx.publicVarNames.length > 0;
    if (hasPublicVars) {
      lines.push("# Migrated from .env — check that public/encrypted classification is correct.");
    } else {
      lines.push("# Migrated from .env — all variables will be encrypted.");
    }

    if (ctx.detectedPrefixes.length > 0) {
      lines.push(`# Variables with ${ctx.detectedPrefixes.join(", ")} prefixes were marked public.`);
      lines.push("#");
      lines.push("# `public` vars are plaintext and will not be encrypted. If any of these");
      lines.push("# should be secret, remove the `public` keyword to enable encryption.");
    } else if (ctx.publicVarNames.length > 0) {
      const names = ctx.publicVarNames.length <= 5
        ? ctx.publicVarNames.join(", ")
        : ctx.publicVarNames.slice(0, 5).join(", ") + `, and ${ctx.publicVarNames.length - 5} more`;
      lines.push("#");
      lines.push(`# Public variables (${names}) are plaintext and will not be encrypted.`);
      lines.push("# If any of these should be secret, remove the `public` keyword to enable encryption.");
    }
  }

  lines.push("#");
  lines.push("# Docs: https://vars-docs.vercel.app/docs/file-format");
  lines.push("#");

  return lines.join("\n");
}
