import { defineCommand } from "citty";
import { resolve } from "node:path";
import { resolveUseChain, decrypt, getKeyFromEnv } from "@vars/node";
import { validateValue, evaluateCheck, isEncrypted } from "@vars/core";
import { findVarsFile, findKeyFile, requireKey } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "check", description: "Validate schemas and run check blocks" },
  args: {
    file: { type: "positional", required: false },
  },
  async run({ args }) {
    const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }

    let key: Buffer | null = getKeyFromEnv();
    const keyFile = findKeyFile(file);

    let errors = 0;
    let warnings = 0;

    // Get env list from a preliminary parse
    const preliminary = resolveUseChain(file, { env: "dev" });

    for (const env of preliminary.envs) {
      const resolved = resolveUseChain(file, { env });

      for (const v of resolved.vars) {
        if (v.value === undefined) continue;

        let value = v.value;
        if (isEncrypted(value)) {
          if (!key && keyFile) {
            try { key = await requireKey(keyFile); } catch { /* skip */ }
          }
          if (key) { value = decrypt(value, key); }
          else { continue; }
        }

        const result = validateValue(v.schema, value);
        if (!result.success) {
          console.error(pc.red(`  ✗ ${v.flatName} [${env}]: ${result.issues?.[0]?.message}`));
          errors++;
        }
      }

      // Run check blocks
      if (resolved.checks.length > 0) {
        const varMap: Record<string, string | undefined> = {};
        for (const v of resolved.vars) {
          let val = v.value;
          if (val && isEncrypted(val) && key) val = decrypt(val, key);
          varMap[v.name] = val;
          varMap[v.flatName] = val;
        }
        for (const check of resolved.checks) {
          for (const pred of check.predicates) {
            try {
              if (!evaluateCheck(pred, varMap, env, {})) {
                console.error(pc.red(`  ✗ check "${check.description}" failed [${env}]`));
                errors++;
              }
            } catch (e: any) {
              console.error(pc.red(`  ✗ check "${check.description}" error: ${e.message}`));
              errors++;
            }
          }
        }
      }
    }

    // Metadata warnings
    for (const v of preliminary.vars) {
      if (v.metadata?.expires && new Date(v.metadata.expires) < new Date()) {
        console.warn(pc.yellow(`  ⚠ ${v.flatName}: expired on ${v.metadata.expires}`));
        warnings++;
      }
      if (v.metadata?.deprecated) {
        console.warn(pc.yellow(`  ⚠ ${v.flatName}: deprecated — ${v.metadata.deprecated}`));
        warnings++;
      }
    }

    if (errors === 0 && warnings === 0) {
      console.log(pc.green("  ✓ All checks passed"));
    } else {
      console.log(`\n  ${errors} error(s), ${warnings} warning(s)`);
      if (errors > 0) process.exit(1);
    }
  },
});
