import { defineCommand } from "citty";
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMasterKey, encryptMasterKey } from "@vars/node";
import { generateTypeScript } from "@vars/core";
import { resolveUseChain } from "@vars/node";
import { getProjectRoot } from "../utils/context.js";
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
        content = `# @vars-state unlocked
env(dev, staging, prod)

# Add your variables below
public APP_NAME = "my-app"
public PORT : z.number() = 3000
`;
      }
      writeFileSync(configPath, content);
    }

    // 4. Update .gitignore
    const gitignorePath = join(root, ".gitignore");
    const varsIgnoreEntries = "\n# vars\n.vars/key\n.vars/key.*\n";
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf8");
      if (!existing.includes(".vars/key")) {
        appendFileSync(gitignorePath, varsIgnoreEntries);
      }
    } else {
      writeFileSync(gitignorePath, varsIgnoreEntries.trim() + "\n");
    }

    // 5. Add #vars import to package.json
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

    // 6. Generate types
    try {
      const resolved = resolveUseChain(configPath, { env: "dev" });
      const code = generateTypeScript(resolved);
      writeFileSync(configPath.replace(/\.vars$/, ".generated.ts"), code);
      console.log(pc.dim("  Generated config.generated.ts"));
    } catch { /* non-fatal */ }

    prompts.outro(pc.green("vars initialized! Run `vars show` to start editing."));
  },
});

function migrateFromEnv(envContent: string): string {
  const lines = ["# @vars-state unlocked", "env(dev, staging, prod)", ""];
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Infer if it looks like a number or boolean
    if (/^\d+$/.test(value)) {
      lines.push(`public ${key} : z.number() = ${value}`);
    } else if (value === "true" || value === "false") {
      lines.push(`public ${key} : z.boolean() = ${value}`);
    } else {
      lines.push(`${key} = "${value}"`);
    }
  }
  return lines.join("\n") + "\n";
}
