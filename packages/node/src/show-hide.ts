import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { parse, isEncrypted } from "@vars/core";
import { encryptDeterministic, decrypt } from "./crypto.js";
import { toUnlockedPath, toLockedPath, isUnlockedPath } from "./unlocked-path.js";

const STATE_LOCKED = "# @vars-state locked";
const STATE_UNLOCKED = "# @vars-state unlocked";

export function showFile(filePath: string, key: Buffer): string {
  const unlockedPath = isUnlockedPath(filePath) ? filePath : toUnlockedPath(filePath);

  // Rename to .unlocked.vars if not already there
  if (!isUnlockedPath(filePath) && existsSync(filePath)) {
    renameSync(filePath, unlockedPath);
  }

  const content = readFileSync(unlockedPath, "utf8");
  const lines = content.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() === STATE_LOCKED) {
      result.push(STATE_UNLOCKED);
      continue;
    }
    // Match encrypted values in both plain assignments and schema-with-default lines:
    //   `  dev = enc:v2:...` or `SECRET = enc:v2:...` or `SECRET : z.string() = enc:v2:...`
    const match = line.match(/^(.*=\s*)(enc:v2:\S+)(.*)$/);
    if (match) {
      const [, prefix, encrypted, suffix] = match;
      const decrypted = decrypt(encrypted, key);
      const escaped = decrypted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      result.push(`${prefix}"${escaped}"${suffix}`);
      continue;
    }
    result.push(line);
  }

  writeFileSync(unlockedPath, result.join("\n"));
  return unlockedPath;
}

export function hideFile(filePath: string, key: Buffer): string {
  const lockedPath = isUnlockedPath(filePath) ? toLockedPath(filePath) : filePath;
  const readPath = filePath;

  const content = readFileSync(readPath, "utf8");
  const parsed = parse(content, readPath);
  const publicVars = new Set<string>();

  // Collect public variable names
  for (const decl of parsed.ast.declarations) {
    if (decl.kind === "variable" && decl.public) publicVars.add(decl.name);
    if (decl.kind === "group") {
      for (const v of decl.declarations) {
        if (v.public) publicVars.add(v.name);
      }
    }
  }

  const lines = content.split("\n");
  const result: string[] = [];
  let currentVar: string | null = null;
  let currentIsPublic = false;
  let currentGroup: string | null = null;
  let checkDepth = 0; // tracks brace depth inside check blocks (>0 means inside a check)

  for (const line of lines) {
    if (line.trim() === STATE_UNLOCKED) {
      result.push(STATE_LOCKED);
      continue;
    }

    // Detect check block starts: `check "..." {`
    if (line.match(/^\s*check\s+/)) {
      if (line.includes("{")) checkDepth = 1;
      result.push(line);
      continue;
    }

    // Track brace depth inside check blocks — skip all content
    if (checkDepth > 0) {
      for (const ch of line) {
        if (ch === "{") checkDepth++;
        else if (ch === "}") checkDepth--;
      }
      result.push(line);
      continue;
    }

    // Detect group starts: `group stripe {`
    const groupMatch = line.match(/^group\s+(\w+)\s*\{/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
    }

    // Detect top-level closing brace to end group context
    if (currentGroup && line.trim() === "}" && !line.match(/^\s{2,}/)) {
      currentGroup = null;
    }

    // Track current variable context to know if public
    // Detect variable declaration lines (top-level or indented inside groups)
    const varMatch = line.match(/^\s*(?:public\s+)?([A-Z][A-Z0-9_]*)\s*[:{=]/);
    if (varMatch) {
      currentVar = varMatch[1];
      currentIsPublic = line.trimStart().startsWith("public") || publicVars.has(currentVar);
    }

    // Match schema-with-default lines: `NAME : z.schema() = "value"`
    // Must be checked BEFORE the plain assignment regex since both could match
    const schemaDefaultMatch = line.match(
      /^(\s*(?:public\s+)?[A-Z][A-Z0-9_]*\s*:\s*[^=]+=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/,
    );
    if (schemaDefaultMatch && !currentIsPublic) {
      const [, prefix, rawValue, suffix] = schemaDefaultMatch;

      // Only encrypt quoted string values — bare numbers/booleans are not secrets
      if (!rawValue.startsWith('"') && !rawValue.startsWith("'")) {
        result.push(line);
        continue;
      }

      const value = rawValue.slice(1, -1);

      if (isEncrypted(value)) {
        result.push(line);
        continue;
      }

      const context = currentGroup
        ? `${currentGroup.toUpperCase()}_${currentVar}@default`
        : `${currentVar}@default`;
      const encrypted = encryptDeterministic(value, key, context);
      result.push(`${prefix}${encrypted}${suffix}`);
      continue;
    }

    // Match value assignment lines (indented env-block values or flat top-level assignments):
    //   `  dev = "value"` or `SECRET = "value"`
    const envMatch = line.match(/^(\s*\w[\w-]*\s*=\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)(.*)$/);
    if (envMatch && !currentIsPublic) {
      const [, prefix, rawValue, suffix] = envMatch;

      // Skip lines that are variable declarations (no schema default — block opener or simple name = value)
      // e.g. `SECRET : z.string() {` or `SECRET : z.string().url() {`
      if (line.match(/^\s*(?:public\s+)?[A-Z][A-Z0-9_]*\s*:.*\{\s*$/)) {
        result.push(line);
        continue;
      }

      const value =
        rawValue.startsWith('"') || rawValue.startsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue;

      // Skip if already encrypted
      if (isEncrypted(value)) {
        result.push(line);
        continue;
      }

      // Skip triple-quoted (multi-line) — handled differently
      if (rawValue.startsWith('"""')) {
        result.push(line);
        continue;
      }

      // Derive context for deterministic encryption, including group if present
      const envName = line.trim().split(/\s*=/)[0].trim();
      const context = currentGroup
        ? `${currentGroup.toUpperCase()}_${currentVar}@${envName}`
        : `${currentVar}@${envName}`;
      const encrypted = encryptDeterministic(value, key, context);
      result.push(`${prefix}${encrypted}${suffix}`);
      continue;
    }

    result.push(line);
  }

  // Write encrypted content, then rename to locked path
  writeFileSync(readPath, result.join("\n"));
  if (isUnlockedPath(readPath) && readPath !== lockedPath) {
    renameSync(readPath, lockedPath);
  }
  return lockedPath;
}
