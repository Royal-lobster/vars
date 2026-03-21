import type { EnvironmentValue, Metadata, Refine, Variable, VarsFile } from "./types.js";
import { ParseError } from "./errors.js";

const VAR_PATTERN = /^([A-Z][A-Z0-9_]*)[ \t]{2,}(z\..+)$/;
const ENV_VALUE_PATTERN = /^[ \t]+@(\w[\w-]*)[ \t]+=[ \t]+(.*)$/;
const METADATA_PATTERN = /^[ \t]+@(description|expires|deprecated|owner)[ \t]+(.+)$/;
const EXTENDS_PATTERN = /^@extends[ \t]+(.+)$/;
const REFINE_START_PATTERN = /^@refine[ \t]+(.+)$/;
const COMMENT_PATTERN = /^#/;
const EMPTY_PATTERN = /^[ \t]*$/;

export function parse(input: string, filePath?: string): VarsFile {
  const lines = input.split("\n");
  const variables: Variable[] = [];
  const refines: Refine[] = [];
  let extendsPath: string | null = null;
  let currentVar: Variable | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Empty lines
    if (EMPTY_PATTERN.test(line)) {
      continue;
    }

    // Comments
    if (COMMENT_PATTERN.test(line)) {
      continue;
    }

    // @extends directive
    const extendsMatch = line.match(EXTENDS_PATTERN);
    if (extendsMatch) {
      if (extendsPath !== null) {
        throw new ParseError("Multiple @extends directives not allowed", lineNum, filePath);
      }
      extendsPath = extendsMatch[1].trim();
      currentVar = null;
      continue;
    }

    // @refine directive
    const refineMatch = line.match(REFINE_START_PATTERN);
    if (refineMatch) {
      const expression = refineMatch[1].trim();
      // Next line should be the error message (indented string)
      const nextLine = lines[i + 1];
      if (!nextLine || !nextLine.match(/^[ \t]+/)) {
        throw new ParseError("@refine must be followed by an indented error message", lineNum, filePath);
      }
      const message = nextLine.trim().replace(/^["']|["']$/g, "");
      refines.push({ expression, message, line: lineNum });
      i++; // skip message line
      currentVar = null;
      continue;
    }

    // Indented lines (env values or metadata) — must belong to a variable
    if (line.match(/^[ \t]+/)) {
      if (!currentVar) {
        throw new ParseError("Indented line without a parent variable", lineNum, filePath);
      }

      // Metadata directive (no = sign)
      const metaMatch = line.match(METADATA_PATTERN);
      if (metaMatch) {
        const directive = metaMatch[1] as keyof Metadata;
        const rawValue = metaMatch[2].trim().replace(/^["']|["']$/g, "");
        currentVar.metadata[directive] = rawValue;
        continue;
      }

      // Environment value (has = sign)
      const envMatch = line.match(ENV_VALUE_PATTERN);
      if (envMatch) {
        const env = envMatch[1];
        const rawValue = envMatch[2];
        const value = parseValue(rawValue);
        currentVar.values.push({ env, value, line: lineNum });
        continue;
      }

      throw new ParseError(`Invalid indented line: ${line.trim()}`, lineNum, filePath);
    }

    // Variable declaration
    const varMatch = line.match(VAR_PATTERN);
    if (varMatch) {
      currentVar = {
        name: varMatch[1],
        schema: varMatch[2].trim(),
        values: [],
        metadata: {},
        line: lineNum,
      };
      variables.push(currentVar);
      continue;
    }

    // If we get here, the line doesn't match any known pattern
    // Check if it looks like a variable but with wrong name format
    const parts = line.split(/[ \t]{2,}/);
    if (parts.length >= 2 && parts[1].startsWith("z.")) {
      throw new ParseError(
        `Invalid variable name "${parts[0]}": must be UPPER_SNAKE_CASE`,
        lineNum,
        filePath,
      );
    }

    // Check if it's a single word with no schema
    if (/^[A-Z][A-Z0-9_]*$/.test(line.trim())) {
      throw new ParseError(
        `Variable "${line.trim()}" is missing a schema definition`,
        lineNum,
        filePath,
      );
    }

    throw new ParseError(`Unexpected line: ${line}`, lineNum, filePath);
  }

  return { variables, refines, extendsPath };
}

function parseValue(raw: string): string {
  const trimmed = raw.trim();

  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Inline comment stripping (unquoted # starts a comment)
  const commentIdx = trimmed.indexOf(" #");
  if (commentIdx !== -1) {
    return trimmed.slice(0, commentIdx).trimEnd();
  }

  return trimmed;
}
