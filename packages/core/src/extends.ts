import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ExtendsError } from "./errors.js";
import { parse } from "./parser.js";
import type { Variable, VarsFile } from "./types.js";

const MAX_DEPTH = 3;

export function resolveExtends(filePath: string, maxDepth = MAX_DEPTH): VarsFile {
  return resolveExtendsRecursive(filePath, maxDepth, new Set());
}

function resolveExtendsRecursive(
  filePath: string,
  remainingDepth: number,
  visited: Set<string>,
): VarsFile {
  const absPath = resolve(filePath);

  if (visited.has(absPath)) {
    throw new ExtendsError(`Circular @extends detected: ${absPath}`, absPath);
  }

  if (remainingDepth <= 0) {
    throw new ExtendsError(`@extends depth exceeds maximum of ${MAX_DEPTH}`, absPath);
  }

  visited.add(absPath);

  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    throw new ExtendsError(`Cannot resolve @extends: ${absPath} (file not found)`, absPath);
  }

  const parsed = parse(content, absPath);

  if (!parsed.extendsPath) {
    return parsed;
  }

  const parentPath = resolve(dirname(absPath), parsed.extendsPath);
  const parent = resolveExtendsRecursive(parentPath, remainingDepth - 1, visited);

  return mergeVarsFiles(parent, parsed);
}

function mergeVarsFiles(parent: VarsFile, child: VarsFile): VarsFile {
  const mergedVars = new Map<string, Variable>();

  // Add parent variables first
  for (const v of parent.variables) {
    mergedVars.set(v.name, { ...v, values: [...v.values] });
  }

  // Child overrides/extends parent
  for (const childVar of child.variables) {
    const parentVar = mergedVars.get(childVar.name);
    if (!parentVar) {
      // New variable only in child
      mergedVars.set(childVar.name, childVar);
    } else {
      // Merge: child values override parent values for same env
      const mergedValues = [...parentVar.values];
      for (const childVal of childVar.values) {
        const idx = mergedValues.findIndex((v) => v.env === childVal.env);
        if (idx >= 0) {
          mergedValues[idx] = childVal;
        } else {
          mergedValues.push(childVal);
        }
      }
      mergedVars.set(childVar.name, {
        ...childVar,
        values: mergedValues,
        metadata: { ...parentVar.metadata, ...childVar.metadata },
      });
    }
  }

  return {
    variables: [...mergedVars.values()],
    refines: [...parent.refines, ...child.refines],
    extendsPath: child.extendsPath,
  };
}
