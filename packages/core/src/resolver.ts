import type {
  Declaration,
  VariableDecl,
  Value,
  EnvBlockValue,
  ConditionalValue,
  EnvEntry,
  ResolvedVar,
  ResolvedVars,
  Param,
} from "./types.js";

export function resolveValue(
  decl: VariableDecl,
  env: string,
  params: Record<string, string>,
): string | undefined {
  if (!decl.value) return undefined;
  return resolveValueNode(decl.value, env, params);
}

function resolveValueNode(
  value: Value,
  env: string,
  params: Record<string, string>,
): string | undefined {
  switch (value.kind) {
    case "literal":
      return String(value.value);
    case "encrypted":
      return value.raw;
    case "interpolated":
      // Return template as-is for now; interpolation is resolved in resolveAll after all vars are known
      return value.template;
    case "env_block":
      return resolveEnvBlock(value, env, params);
    case "conditional":
      return resolveConditional(value, env, params);
  }
}

function resolveEnvBlock(
  block: EnvBlockValue,
  env: string,
  params: Record<string, string>,
): string | undefined {
  // First: try when-qualified entries matching current params and env (highest priority)
  for (const entry of block.entries) {
    if (entry.env === env && entry.when) {
      const paramValue = params[entry.when.param];
      if (paramValue === entry.when.value) {
        return resolveValueNode(entry.value, env, params);
      }
    }
  }

  // Second: try bare env match (no when condition)
  for (const entry of block.entries) {
    if (entry.env === env && !entry.when) {
      return resolveValueNode(entry.value, env, params);
    }
  }

  // Third: try wildcard "*" entry (default fallback for all envs)
  for (const entry of block.entries) {
    if (entry.env === "*" && !entry.when) {
      return resolveValueNode(entry.value, env, params);
    }
  }

  return undefined;
}

function resolveEnvEntries(
  entries: EnvEntry[],
  env: string,
  params: Record<string, string>,
): string | undefined {
  for (const entry of entries) {
    if (entry.env === env) {
      return resolveValueNode(entry.value, env, params);
    }
  }
  return undefined;
}

function resolveConditional(
  cond: ConditionalValue,
  env: string,
  params: Record<string, string>,
): string | undefined {
  for (const when of cond.whens) {
    const paramValue = params[when.param] ?? "";
    if (paramValue === when.value) {
      if (Array.isArray(when.result)) {
        // Result is EnvEntry[] — find matching env
        return resolveEnvEntries(when.result, env, params);
      }
      // Result is a single Value
      return resolveValueNode(when.result, env, params);
    }
  }

  // Fallback
  if (cond.fallback) {
    return resolveValueNode(cond.fallback, env, params);
  }

  return undefined;
}

export function resolveInterpolation(
  template: string,
  resolved: Map<string, string>,
): string {
  return template.replace(/\\?\$\{([^}]+)\}/g, (match, varName) => {
    if (match.startsWith("\\")) {
      return match.slice(1); // escaped \${...} → ${...}
    }
    const value = resolved.get(varName);
    if (value === undefined) {
      throw new Error(`Unresolved interpolation reference: \${${varName}}`);
    }
    return value;
  });
}

export function resolveAll(
  declarations: Declaration[],
  env: string,
  params: Record<string, string>,
  envs: string[],
  paramDefs: Param[],
): ResolvedVars {
  const resolvedVars: ResolvedVar[] = [];

  // Collect names of all vars that belong to a group so we can
  // deduplicate top-level "ghost" entries that share the same name.
  const groupedVarNames = new Set<string>();
  for (const decl of declarations) {
    if (decl.kind === "group") {
      for (const varDecl of decl.declarations) {
        groupedVarNames.add(varDecl.name);
      }
    }
  }

  // First pass: resolve all values (without interpolation)
  for (const decl of declarations) {
    if (decl.kind === "variable") {
      // Skip top-level vars that also exist inside a group — the group
      // version is authoritative (has the correct schema, group tag, etc.).
      if (groupedVarNames.has(decl.name)) continue;

      resolvedVars.push({
        name: decl.name,
        flatName: decl.name,
        public: decl.public,
        schema: decl.schema ?? "z.string()",
        value: resolveValue(decl, env, params),
        metadata: decl.metadata,
      });
    } else if (decl.kind === "group") {
      const groupPrefix = decl.name.toUpperCase() + "_";
      for (const varDecl of decl.declarations) {
        // Avoid stuttered flatName: if the var name already starts with
        // the group prefix (case-insensitive), use the var name as-is.
        const alreadyPrefixed = varDecl.name.toUpperCase().startsWith(groupPrefix);
        const flatName = alreadyPrefixed
          ? varDecl.name
          : `${groupPrefix}${varDecl.name}`;

        resolvedVars.push({
          name: varDecl.name,
          flatName,
          public: varDecl.public,
          schema: varDecl.schema ?? "z.string()",
          value: resolveValue(varDecl, env, params),
          metadata: varDecl.metadata,
          group: decl.name,
        });
      }
    }
  }

  // Second pass: resolve interpolation iteratively until stable
  const MAX_ITERATIONS = 10;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Build fresh value map each iteration
    const valueMap = new Map<string, string>();
    for (const v of resolvedVars) {
      if (v.value !== undefined) {
        valueMap.set(v.name, v.value);
        valueMap.set(v.flatName, v.value);
      }
    }

    let changed = false;
    for (const v of resolvedVars) {
      if (v.value && v.value.includes("${")) {
        const resolved = resolveInterpolation(v.value, valueMap);
        if (resolved !== v.value) {
          v.value = resolved;
          changed = true;
        }
      }
    }

    if (!changed) break; // stable — all interpolation resolved
  }

  return {
    vars: resolvedVars,
    checks: [],
    envs,
    params: paramDefs,
    sourceFiles: [],
  };
}
