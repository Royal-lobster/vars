import { ALL_PUBLIC_PREFIXES } from "./detect-framework.js";

/**
 * Convert a .env file's content into .vars format.
 * Variables matching the given public prefixes are annotated with `public`.
 */
export function migrateFromEnv(envContent: string, publicPrefixes: string[] = ALL_PUBLIC_PREFIXES): string {
  const lines = ["# @vars-state unlocked", "env(dev, staging, prod)", ""];
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    // Skip invalid identifiers
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      console.warn(`  Skipping invalid variable name: ${key}`);
      continue;
    }
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip inline comments (space + #) from unquoted values
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }
    // Strip surrounding quotes (double or single)
    let wasQuoted = false;
    if (value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
         (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
      wasQuoted = true;
    }
    const isPublic = publicPrefixes.some(p => key.startsWith(p));
    const pub = isPublic ? "public " : "";
    // Infer type only for unquoted values
    if (!wasQuoted && /^\d+$/.test(value)) {
      lines.push(`${pub}${key} : z.number() = ${value}`);
    } else if (!wasQuoted && (value === "true" || value === "false")) {
      lines.push(`${pub}${key} : z.boolean() = ${value}`);
    } else {
      lines.push(`${pub}${key} = "${value}"`);
    }
  }
  return lines.join("\n") + "\n";
}
