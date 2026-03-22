import { defineCommand } from "citty";
import { resolve } from "node:path";
import { resolveUseChain, decrypt, getKeyFromEnv } from "@vars/node";
import { isEncrypted } from "@vars/core";
import { findVarsFile, findKeyFile, requireKey, resolveEnv } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "export", description: "Export resolved values" },
  args: {
    env: { type: "string", required: true, alias: "e" },
    format: { type: "string", default: "dotenv", description: "Output format: dotenv, json, k8s-secret" },
    file: { type: "positional", required: false },
    param: { type: "string" },
  },
  async run({ args }) {
    const env = resolveEnv(args.env);
    const params: Record<string, string> = {};
    if (args.param) {
      for (const p of (Array.isArray(args.param) ? args.param : [args.param])) {
        const [k, v] = (p as string).split("=");
        if (k && v) params[k] = v;
      }
    }

    const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
    if (!file) { console.error(pc.red("No .vars file found")); process.exit(1); }

    // Resolve use chain (no key needed — just parsing)
    const resolved = resolveUseChain(file, { env, params });

    // Validate env name against declared envs
    if (resolved.envs.length > 0 && !resolved.envs.includes(env)) {
      console.error(pc.red(`  Unknown environment "${env}". Declared environments: ${resolved.envs.join(", ")}`));
      process.exit(1);
    }

    let key: Buffer | null = getKeyFromEnv();
    if (!key) {
      const keyFile = findKeyFile(file);
      key = await requireKey(keyFile);
    }

    const pairs: [string, string][] = [];
    for (const v of resolved.vars) {
      if (v.value === undefined) continue;
      const val = isEncrypted(v.value) ? decrypt(v.value, key) : v.value;
      pairs.push([v.flatName, val]);
    }

    switch (args.format) {
      case "dotenv":
        for (const [k, v] of pairs) {
          const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
          console.log(`${k}="${escaped}"`);
        }
        break;
      case "json": {
        const obj: Record<string, string | number | boolean> = {};
        for (const [k, v] of pairs) {
          const varDef = resolved.vars.find(rv => rv.flatName === k);
          if (varDef && (varDef.schema.includes("z.number") || varDef.schema.includes("z.coerce.number"))) {
            obj[k] = Number(v);
          } else if (varDef && (varDef.schema.includes("z.boolean") || varDef.schema.includes("z.coerce.boolean"))) {
            obj[k] = v === "true";
          } else {
            obj[k] = v;
          }
        }
        console.log(JSON.stringify(obj, null, 2));
        break;
      }
      case "k8s-secret": {
        const data: Record<string, string> = {};
        for (const [k, v] of pairs) data[k] = Buffer.from(v).toString("base64");
        console.log(JSON.stringify({
          apiVersion: "v1", kind: "Secret",
          metadata: { name: "app-secrets" },
          type: "Opaque", data,
        }, null, 2));
        break;
      }
      default:
        console.error(pc.red(`Unknown format: ${args.format}`));
        process.exit(1);
    }
  },
});
