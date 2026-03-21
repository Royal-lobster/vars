import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Add a "#vars" path alias to tsconfig.json so users can:
 *   import { env } from "#vars"
 */
export function addTsconfigPathAlias(cwd: string): boolean {
  const tsconfigPath = join(cwd, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return false;

  try {
    const raw = readFileSync(tsconfigPath, "utf8");
    const tsconfig = JSON.parse(raw);

    if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
    if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};

    if (tsconfig.compilerOptions.paths["#vars"]) return true;

    tsconfig.compilerOptions.paths["#vars"] = ["./.vars/vars.generated.ts"];

    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
