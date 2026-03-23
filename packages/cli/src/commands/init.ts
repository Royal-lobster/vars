import { defineCommand } from "citty";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMasterKey, encryptMasterKey } from "@vars/node";
import { generateTypeScript } from "@vars/core";
import { resolveUseChain } from "@vars/node";
import { getProjectRoot } from "../utils/context.js";
import * as prompts from "@clack/prompts";
import pc from "picocolors";

export const PUBLIC_PREFIXES = ["NEXT_PUBLIC_", "VITE_", "REACT_APP_", "NUXT_PUBLIC_", "EXPO_PUBLIC_", "GATSBY_"];

export interface HeaderCommentContext {
  source: "env" | "boilerplate";
  publicVarNames: string[];
  totalVarCount: number;
  detectedPrefixes: string[];
}

export function buildHeaderComment(ctx: HeaderCommentContext): string {
  const lines: string[] = ["#"];
  // Short-form for small files: avoids comment-to-content ratio > 1:1
  const isShortForm = ctx.source === "env" && ctx.totalVarCount > 0 && ctx.totalVarCount <= 5;

  if (ctx.source === "boilerplate") {
    lines.push("# Replace the example variables below with your own.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (ctx.source === "env" && ctx.totalVarCount === 0) {
    lines.push("# No variables found in .env — add your own below.");
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else if (isShortForm) {
    lines.push("# `public` = plaintext (not encrypted). Remove it to encrypt a var.");
  } else {
    // Long-form migration (> 5 vars)
    const hasPublicVars = ctx.detectedPrefixes.length > 0 || ctx.publicVarNames.length > 0;
    if (hasPublicVars) {
      lines.push("# Migrated from .env — check that public/encrypted classification is correct.");
    } else {
      lines.push("# Migrated from .env — all variables will be encrypted.");
    }

    if (ctx.detectedPrefixes.length > 0) {
      lines.push(`# Variables with ${ctx.detectedPrefixes.join(", ")} prefixes were marked public.`);
      lines.push("#");
      lines.push("# `public` vars are plaintext and will not be encrypted. If any of these");
      lines.push("# should be secret, remove the `public` keyword to enable encryption.");
    } else if (ctx.publicVarNames.length > 0) {
      const names = ctx.publicVarNames.length <= 5
        ? ctx.publicVarNames.join(", ")
        : ctx.publicVarNames.slice(0, 5).join(", ") + `, and ${ctx.publicVarNames.length - 5} more`;
      lines.push("#");
      lines.push(`# Public variables (${names}) are plaintext and will not be encrypted.`);
      lines.push("# If any of these should be secret, remove the `public` keyword to enable encryption.");
    }
  }

  lines.push("#");
  lines.push("# Docs: https://vars-docs.vercel.app/docs/file-format");
  lines.push("#");

  return lines.join("\n");
}

export default defineCommand({
  meta: { name: "init", description: "Initialize vars in the current project" },
  args: {},
  async run() {
    const root = getProjectRoot();
    const varsDir = join(root, ".vars");
    const keyPath = join(varsDir, "key");

    if (existsSync(keyPath)) {
      console.log(pc.yellow("  vars is already initialized (.vars/key exists)"));
      return;
    }

    prompts.intro(pc.bold("vars init"));

    if (!process.stdin.isTTY) {
      console.error(pc.red("vars init requires an interactive terminal to set a PIN."));
      console.error(pc.dim("Run this command directly in your terminal, not in a script."));
      process.exit(1);
    }

    // 1. Set PIN
    const pin = await prompts.password({ message: "Set a PIN to protect your encryption key:" });
    if (prompts.isCancel(pin)) process.exit(0);
    const confirm = await prompts.password({ message: "Confirm PIN:" });
    if (prompts.isCancel(confirm)) process.exit(0);
    if (pin !== confirm) {
      console.error(pc.red("  PINs do not match. Try again."));
      process.exit(1);
    }

    // 2. Create key
    if (!existsSync(varsDir)) mkdirSync(varsDir, { recursive: true });
    const masterKey = await createMasterKey();
    const encryptedKey = await encryptMasterKey(masterKey, pin as string);
    writeFileSync(keyPath, encryptedKey + "\n");

    // 3. Create starter config.vars
    const configPath = join(root, "config.vars");
    if (!existsSync(configPath)) {
      const envFile = join(root, ".env");
      let content: string;

      if (existsSync(envFile)) {
        // Migrate from .env
        content = migrateFromEnv(readFileSync(envFile, "utf8"));
        console.log(pc.dim("  Migrated from .env"));
      } else {
        const header = buildHeaderComment({
          source: "boilerplate",
          publicVarNames: [],
          totalVarCount: 0,
          detectedPrefixes: [],
        });
        content = `# @vars-state unlocked
${header}
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000
DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
`;
      }
      writeFileSync(configPath, content);
    }

    // 4. Install zod if not already present
    const pkgJsonPath = join(root, "package.json");
    if (existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (!allDeps["zod"]) {
          // Detect package manager
          const pm = existsSync(join(root, "pnpm-lock.yaml")) ? "pnpm"
            : existsSync(join(root, "yarn.lock")) ? "yarn"
            : (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) ? "bun"
            : "npm";
          console.log(pc.dim(`  Installing zod...`));
          const { execSync } = await import("node:child_process");
          execSync(`${pm} add zod`, { cwd: root, stdio: "pipe" });
        }
      } catch { /* non-fatal */ }
    }

    // 5. Update .gitignore
    const gitignorePath = join(root, ".gitignore");
    const varsIgnoreEntries = "\n# vars\n.vars/key\n.vars/key.*\n*.unlocked.vars\n";
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf8");
      if (!existing.includes("*.unlocked.vars")) {
        appendFileSync(gitignorePath, varsIgnoreEntries);
      }
    } else {
      writeFileSync(gitignorePath, varsIgnoreEntries.trim() + "\n");
    }

    // 6. Install pre-commit hook
    try {
      const huskyDir = join(root, ".husky");
      const gitHookDir = join(root, ".git", "hooks");
      const hookPath = existsSync(huskyDir) ? join(huskyDir, "pre-commit") : join(gitHookDir, "pre-commit");

      const HOOK_MARKER = "# vars: check for unlocked files";
      const HOOK_SCRIPT = `\n${HOOK_MARKER}\nif git diff --cached --name-only 2>/dev/null | grep -q '\\.unlocked\\.vars$'; then\n  echo ""\n  echo "vars: Unlocked .vars files cannot be committed."\n  echo "  Run 'vars hide' to encrypt before committing."\n  echo ""\n  exit 1\nfi\n`;

      if (existsSync(hookPath)) {
        const existing = readFileSync(hookPath, "utf8");
        if (!existing.includes(HOOK_MARKER)) {
          writeFileSync(hookPath, existing.trimEnd() + "\n" + HOOK_SCRIPT);
        }
      } else {
        const dir = join(hookPath, "..");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(hookPath, "#!/bin/sh\n" + HOOK_SCRIPT);
      }
      chmodSync(hookPath, 0o755);
      console.log(pc.dim("  Installed pre-commit hook"));
    } catch { /* non-fatal — .git may not exist */ }

    // 7. Add #vars import to package.json
    const pkgPath = join(root, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (!pkg.imports?.["#vars"]) {
          pkg.imports = pkg.imports || {};
          pkg.imports["#vars"] = "./config.generated.ts";
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
          console.log(pc.dim("  Added #vars import to package.json"));
        }
      } catch { /* skip if parse fails */ }
    }

    // 8. Generate types
    try {
      const resolved = resolveUseChain(configPath, { env: "dev" });
      const code = generateTypeScript(resolved);
      writeFileSync(configPath.replace(/\.vars$/, ".generated.ts"), code);
      console.log(pc.dim("  Generated config.generated.ts"));
    } catch { /* non-fatal */ }

    prompts.outro(pc.green("vars initialized! Run `vars show` to start editing."));
  },
});

export function migrateFromEnv(envContent: string): string {
  const detectedPrefixes = new Set<string>();
  const publicVarNames: string[] = [];
  const varLines: string[] = [];

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      console.warn(pc.yellow(`  Skipping invalid variable name: ${key}`));
      continue;
    }
    let value = trimmed.slice(eqIdx + 1).trim();
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    }
    let wasQuoted = false;
    if (value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
         (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
      wasQuoted = true;
    }

    const matchedPrefix = PUBLIC_PREFIXES.find(p => key.startsWith(p));
    const isPublic = !!matchedPrefix;
    if (matchedPrefix) detectedPrefixes.add(matchedPrefix);
    if (isPublic) publicVarNames.push(key);

    const pub = isPublic ? "public " : "";
    if (!wasQuoted && /^\d+$/.test(value)) {
      varLines.push(`${pub}${key} : z.number() = ${value}`);
    } else if (!wasQuoted && (value === "true" || value === "false")) {
      varLines.push(`${pub}${key} : z.boolean() = ${value}`);
    } else {
      varLines.push(`${pub}${key} = "${value}"`);
    }
  }

  const header = buildHeaderComment({
    source: "env",
    publicVarNames,
    totalVarCount: varLines.length,
    detectedPrefixes: [...detectedPrefixes],
  });

  const lines = [
    "# @vars-state unlocked",
    header,
    "env(dev, staging, prod)",
    "",
    ...varLines,
  ];

  return lines.join("\n") + "\n";
}
