import { defineCommand } from "citty";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { resolveUseChain, decrypt, getKeyFromEnv } from "@vars/node";
import { isEncrypted } from "@vars/core";
import { findVarsFile, findKeyFile, requireKey, resolveEnv } from "../utils/context.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "run", description: "Run a command with decrypted env vars injected" },
  args: {
    env: { type: "string", required: true, alias: "e", description: "Target environment" },
    param: { type: "string", description: "Param values (key=value), repeatable" },
    file: { type: "string", alias: "f", description: ".vars file path" },
  },
  async run({ args, rawArgs }) {
    const env = resolveEnv(args.env);
    const params: Record<string, string> = {};
    if (args.param) {
      const paramList = Array.isArray(args.param) ? args.param : [args.param];
      for (const p of paramList) {
        const [k, v] = (p as string).split("=");
        if (k && v) params[k] = v;
      }
    }

    const file = args.file ? resolve(args.file as string) : findVarsFile(process.cwd());
    if (!file) {
      console.error(pc.red("No .vars file found"));
      process.exit(1);
    }

    // Resolve all variables (no key needed — just parsing)
    const resolved = resolveUseChain(file, { env, params });

    // Validate env name against declared envs
    if (resolved.envs.length > 0 && !resolved.envs.includes(env)) {
      console.error(pc.red(`  Unknown environment "${env}". Declared environments: ${resolved.envs.join(", ")}`));
      process.exit(1);
    }

    // Get key
    let key: Buffer | null = getKeyFromEnv();
    if (!key) {
      const keyFile = findKeyFile(file);
      key = await requireKey(keyFile, `vars run --env ${env} -- ${rawArgs.slice(rawArgs.indexOf("--") + 1).join(" ")}`);
    }

    // Build env vars (decrypt encrypted values)
    const envVars: Record<string, string> = {};
    for (const v of resolved.vars) {
      if (v.value === undefined) continue;
      envVars[v.flatName] = isEncrypted(v.value) ? decrypt(v.value, key) : v.value;
    }

    // Find command after --
    const dashDash = rawArgs.indexOf("--");
    if (dashDash === -1 || dashDash === rawArgs.length - 1) {
      console.error(pc.red("Usage: vars run --env <env> -- <command>"));
      process.exit(1);
    }
    const cmd = rawArgs.slice(dashDash + 1);

    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: "inherit",
      env: { ...process.env, ...envVars, VARS_ENV: env },
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  },
});
