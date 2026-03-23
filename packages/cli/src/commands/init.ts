import { defineCommand } from "citty";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMasterKey, encryptMasterKey } from "@vars/node";
import { generateTypeScript } from "@vars/core";
import { resolveUseChain } from "@vars/node";
import { getProjectRoot } from "../utils/context.js";
import { detectFramework, ALL_PUBLIC_PREFIXES } from "../utils/detect-framework.js";
import { migrateFromEnv } from "../utils/migrate-from-env.js";
import * as prompts from "@clack/prompts";
import pc from "picocolors";

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
        // Detect framework to determine public var prefixes
        const framework = detectFramework(root);
        const publicPrefixes = framework
          ? framework.publicPrefixes
          : ALL_PUBLIC_PREFIXES;
        if (framework) {
          const prefixMsg = publicPrefixes.length
            ? `using ${publicPrefixes.join(", ")} prefix${publicPrefixes.length > 1 ? "es" : ""}`
            : "no public var prefixes";
          console.log(pc.dim(`  Detected ${framework.name} — ${prefixMsg}`));
        }
        // Migrate from .env
        content = migrateFromEnv(readFileSync(envFile, "utf8"), publicPrefixes);
        console.log(pc.dim("  Migrated from .env"));
      } else {
        content = `# @vars-state unlocked
env(dev, staging, prod)

# Add your variables below
public APP_NAME = "my-app"
public PORT : z.number() = 3000
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

