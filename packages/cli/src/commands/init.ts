import { defineCommand } from "citty";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  createMasterKey,
  encryptMasterKey,
  encrypt,
  regenerateIfStale,
} from "@vars/core";
import pc from "picocolors";
import * as clack from "@clack/prompts";
import * as output from "../utils/output.js";
import { promptConfirm, promptPIN } from "../utils/prompt.js";
import { detectFramework, applyFrameworkConfig, wrapDevScript } from "../utils/detect-framework.js";
import { installHook } from "./hook.js";

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new .vars project from existing .env files",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .env file to import",
      alias: "f",
    },
    env: {
      type: "string",
      description: "Environment name for imported values",
      default: "dev",
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const varsDir = resolve(cwd, ".vars");
    const varsPath = resolve(varsDir, "vault.vars");

    const unlockedVarsPath = resolve(varsDir, "unlocked.vars");
    const keyPath = resolve(varsDir, "key");

    if ((existsSync(varsPath) || existsSync(unlockedVarsPath)) && existsSync(keyPath)) {
      output.warn(
        ".vars already initialized. Use 'vars add' to add variables.",
      );
      return;
    }

    // vault.vars or unlocked.vars exists but key is missing — incomplete setup, repair it
    if ((existsSync(varsPath) || existsSync(unlockedVarsPath)) && !existsSync(keyPath)) {
      output.intro("init");
      clack.log.message("Found .vars/vault.vars but missing key file. Repairing setup.");

      let pin: string;
      for (;;) {
        pin = await promptPIN("Choose a PIN");
        const pinConfirm = await promptPIN("Confirm PIN");
        if (pin === pinConfirm) break;
        output.error("PINs do not match. Try again.");
      }

      output.warning("Your PIN is the only way to decrypt your secrets.", [
        "No recovery mechanism — lose it, lose everything",
        "Store it in a password manager, team chat, or written down",
        "Keep it somewhere your coding agent can't access",
      ]);

      const masterKey = await createMasterKey();
      const encryptedKey = await encryptMasterKey(masterKey, pin);

      // Encrypt any plaintext values in the existing vault.vars
      const content = readFileSync(varsPath, "utf8");
      const lines = content.split("\n");
      const result: string[] = [];

      for (const line of lines) {
        const match = line.match(/^(\s+@\w+\s*=\s*)(.+)$/);
        if (match) {
          const prefix = match[1];
          const value = match[2].trim();
          // Only encrypt if not already encrypted
          if (value && !value.startsWith("enc:")) {
            result.push(`${prefix}${encrypt(value, masterKey)}`);
            continue;
          }
        }
        result.push(line);
      }

      writeFileSync(varsPath, result.join("\n"));
      writeFileSync(keyPath, encryptedKey + "\n");
      updateGitignore(cwd);
      regenerateIfStale(varsPath, ".vars/vault.vars");

      try { installHook(cwd); } catch { /* no .git — skip */ }

      clack.log.message(pc.bold("Repaired:"));
      output.fileTree(".vars/", [
        { path: "vault.vars", description: "Values encrypted with new key" },
        { path: "key", description: "PIN-protected master key (gitignored)" },
      ]);

      output.outro("Setup repaired. Run vars show to start editing.");
      return;
    }

    // ── Intro ──────────────────────────────────────────────────────────
    output.intro("init");
    clack.log.message("Setting up encrypted environment variables.");

    // ── PIN entry with mismatch retry loop ─────────────────────────────
    let pin: string;
    for (;;) {
      pin = await promptPIN("Choose a PIN");
      const pinConfirm = await promptPIN("Confirm PIN");
      if (pin === pinConfirm) break;
      output.error("PINs do not match. Try again.");
    }

    // ── PIN warning (shown AFTER both PINs confirmed) ──────────────────
    output.warning("Your PIN is the only way to decrypt your secrets.", [
      "No recovery mechanism — lose it, lose everything",
      "Store it in a password manager, team chat, or written down",
      "Keep it somewhere your coding agent can't access",
    ]);

    // ── Create master key and encrypt it ───────────────────────────────
    const masterKey = await createMasterKey();
    const encryptedKey = await encryptMasterKey(masterKey, pin);

    // ── Import .env variables ──────────────────────────────────────────
    const envFilePath = args.file ?? join(cwd, ".env");
    let envVars: Array<{ name: string; value: string }> = [];

    const unlockedPath = resolve(varsDir, "unlocked.vars");

    if (existsSync(envFilePath)) {
      envVars = scanEnvFile(envFilePath);

      const envName = args.env ?? "dev";
      const lines: string[] = ["# Generated by vars init", ""];

      for (const { name, value } of envVars) {
        const schema = inferSchema(name, value);
        lines.push(`${name}  ${schema}`);
        lines.push(`  @${envName} = ${value}`);
        lines.push("");
      }

      mkdirSync(varsDir, { recursive: true });
      writeFileSync(unlockedPath, lines.join("\n"));
      writeFileSync(resolve(varsDir, "key"), encryptedKey + "\n");
      updateGitignore(cwd);

      clack.log.info(`Imported ${envVars.length} variables from .env`);
    } else {
      clack.log.info("No .env file found. Creating empty .vars project.");

      const lines: string[] = [
        "# Generated by vars init",
        "",
        "# Add your first variable:",
        "# PORT  z.coerce.number().int().min(1024).max(65535)",
        "#   @dev     = 3000",
        "#   @prod    = 8080",
        "",
      ];

      mkdirSync(varsDir, { recursive: true });
      writeFileSync(unlockedPath, lines.join("\n"));
      writeFileSync(resolve(varsDir, "key"), encryptedKey + "\n");
      updateGitignore(cwd);
    }

    // ── Delete .env prompt ─────────────────────────────────────────────
    if (envVars.length > 0 && existsSync(envFilePath)) {
      const shouldDelete = await promptConfirm(
        "Delete .env? (plaintext secrets are now encrypted)",
      );
      if (shouldDelete) {
        unlinkSync(envFilePath);
      }
    }

    // ── tsconfig path alias ────────────────────────────────────────────
    const tsconfigUpdated = addTsconfigPathAlias(cwd);

    // ── Hook installation (automatic) ─────────────────────────────────
    let hookInstalled = false;
    try {
      installHook(cwd);
      hookInstalled = true;
    } catch {
      // No .git directory or other issue — skip gracefully
    }

    // ── Summary ───────────────────────────────────────────────────────
    const summaryLines = [
      pc.bold("Created:"),
      `  .vars/unlocked.vars ${pc.dim("— your variables (plaintext, ready to edit)")}`,
      `  .vars/key           ${pc.dim("— PIN-protected master key (gitignored)")}`,
      "",
      `${pc.green("\u2713")} .gitignore updated`,
      tsconfigUpdated
        ? `${pc.green("\u2713")} tsconfig.json updated — ${pc.cyan('import { env } from "#vars"')}`
        : `${pc.yellow("\u26a0")} No tsconfig.json found ${pc.dim('— add "#vars": ["./.vars/vars.generated.ts"] to paths manually')}`,
      hookInstalled
        ? `${pc.green("\u2713")} Pre-commit hook installed`
        : `${pc.yellow("\u26a0")} Pre-commit hook not installed ${pc.dim("(run git init, then vars hook install)")}`,
    ];

    // ── Framework detection & auto-configuration ─────────────────────
    const framework = detectFramework(cwd);
    if (framework) {
      const configured = applyFrameworkConfig(cwd, framework);
      if (configured) {
        summaryLines.push(`${pc.green("\u2713")} ${pc.bold(framework.name)} configured — updated ${pc.cyan(framework.configFile)}`);
      } else {
        summaryLines.push(
          `${pc.yellow("\u26a0")} Detected ${pc.bold(framework.name)} but couldn't auto-configure ${pc.cyan(framework.configFile)}`,
          `  ${pc.dim("Add manually:")}`,
          ...framework.snippet.split("\n").map((l) => `  ${pc.dim(l)}`),
          `  ${pc.dim(`Then run: pnpm add ${framework.package}`)}`,
        );
      }

      // Wrap dev script with vars run
      const devWrapped = wrapDevScript(cwd, framework);
      if (devWrapped) {
        summaryLines.push(`${pc.green("\u2713")} dev script updated — ${pc.cyan("pnpm dev")} now prompts for PIN`);
      }
    }

    clack.log.message(summaryLines.join("\n"));

    // ── Outro ──────────────────────────────────────────────────────────
    output.outro("Edit .vars/unlocked.vars, then run vars hide to encrypt.");
  },
});

/**
 * Scan a .env file and return key-value pairs.
 */
export function scanEnvFile(
  filePath: string,
): Array<{ name: string; value: string }> {
  const content = readFileSync(filePath, "utf8");
  const vars: Array<{ name: string; value: string }> = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice(7)
      : trimmed;

    const eqIdx = withoutExport.indexOf("=");
    if (eqIdx === -1) continue;

    const name = withoutExport.slice(0, eqIdx).trim();
    let value = withoutExport.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars.push({ name, value });
  }

  return vars;
}

/**
 * Infer a Zod schema string from a variable name and sample value.
 */
export function inferSchema(name: string, value: string): string {
  if (/^\d+$/.test(value) || /^\d+\.\d+$/.test(value)) {
    return "z.coerce.number()";
  }

  if (value === "true" || value === "false") {
    return "z.coerce.boolean()";
  }

  if (
    /^https?:\/\//i.test(value) ||
    /^postgres(ql)?:\/\//i.test(value) ||
    /^redis:\/\//i.test(value) ||
    /^mongodb(\+srv)?:\/\//i.test(value)
  ) {
    return "z.string().url()";
  }

  const nameLower = name.toLowerCase();
  if (nameLower === "log_level" || nameLower === "loglevel") {
    return 'z.enum(["debug", "info", "warn", "error"])';
  }
  if (
    nameLower === "node_env" ||
    nameLower === "environment" ||
    nameLower === "env"
  ) {
    return 'z.enum(["development", "staging", "production", "test"])';
  }

  return "z.string()";
}

/**
 * Non-interactive init for testing.
 */
export async function initProject(options: {
  cwd: string;
  pin: string;
  env: string;
  interactive: boolean;
}): Promise<void> {
  const { cwd, pin, env } = options;
  const varsDir = resolve(cwd, ".vars");
  const varsPath = resolve(varsDir, "vault.vars");
  const keyPath = resolve(varsDir, "key");

  const masterKey = await createMasterKey();
  const encryptedKey = await encryptMasterKey(masterKey, pin);

  const envFilePath = join(cwd, ".env");
  let envVars: Array<{ name: string; value: string }> = [];
  if (existsSync(envFilePath)) {
    envVars = scanEnvFile(envFilePath);
  }

  const lines: string[] = ["# Generated by vars init", ""];

  for (const { name, value } of envVars) {
    const schema = inferSchema(name, value);
    const encValue = encrypt(value, masterKey);
    lines.push(`${name}  ${schema}`);
    lines.push(`  @${env} = ${encValue}`);
    lines.push("");
  }

  mkdirSync(varsDir, { recursive: true });
  writeFileSync(varsPath, lines.join("\n"));
  writeFileSync(keyPath, encryptedKey + "\n");
  updateGitignore(cwd);
}

function updateGitignore(cwd: string): void {
  const gitignorePath = join(cwd, ".gitignore");
  const varsEntries = [
    "",
    "# vars",
    ".vars/key",
    ".vars/key.*",
    ".vars/unlocked.vars",
    ".env",
    ".env.*",
    ".vars.swp",
    ".vars.swo",
    ".vars~",
    ".vars.bak",
  ].join("\n");

  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, "utf8");
    if (!existing.includes(".vars/key")) {
      appendFileSync(gitignorePath, "\n" + varsEntries + "\n");
    }
  } else {
    writeFileSync(gitignorePath, varsEntries + "\n");
  }
}

/**
 * Add a "#vars" path alias to tsconfig.json so users can:
 *   import { env } from "#vars"
 */
function addTsconfigPathAlias(cwd: string): boolean {
  const tsconfigPath = join(cwd, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return false;

  try {
    const raw = readFileSync(tsconfigPath, "utf8");
    const tsconfig = JSON.parse(raw);

    // Ensure compilerOptions.paths exists
    if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
    if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};

    // Skip if already configured
    if (tsconfig.compilerOptions.paths["#vars"]) return true;

    tsconfig.compilerOptions.paths["#vars"] = ["./.vars/vars.generated.ts"];

    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
