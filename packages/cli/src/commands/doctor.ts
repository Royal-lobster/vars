import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isUnlockedPath, resolveUseChain } from "@vars/node";
import { findKeyFile, findAllVarsFiles, getProjectRoot } from "../utils/context.js";
import { checkExpiry, formatExpiryMessage } from "../utils/expiry.js";
import { HOOK_MARKER } from "./hook.js";
import pc from "picocolors";

export default defineCommand({
  meta: { name: "doctor", description: "Diagnose vars setup" },
  args: {},
  async run() {
    const root = getProjectRoot();
    let issues = 0;

    // Check key
    const keyFile = findKeyFile(root);
    if (keyFile) {
      console.log(pc.green("  ✓ Key file found"));
    } else {
      console.log(pc.red("  ✗ No key file. Run `vars key init`"));
      issues++;
    }

    // Check .gitignore
    const gitignorePath = join(root, ".gitignore");
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, "utf8");
      if (content.includes(".vars/key")) {
        console.log(pc.green("  ✓ .vars/key in .gitignore"));
      } else {
        console.log(pc.red("  ✗ .vars/key not in .gitignore"));
        issues++;
      }
    } else {
      console.log(pc.red("  ✗ No .gitignore found"));
      issues++;
    }

    // Check pre-commit hook
    const hookPaths = [
      join(root, ".husky", "pre-commit"),
      join(root, ".git", "hooks", "pre-commit"),
    ];
    const OLD_HOOK_MARKER = "@vars-state";
    let hookStatus: "current" | "outdated" | "missing" = "missing";
    for (const p of hookPaths) {
      if (!existsSync(p)) continue;
      const content = readFileSync(p, "utf8");
      if (content.includes(HOOK_MARKER)) { hookStatus = "current"; break; }
      if (content.includes(OLD_HOOK_MARKER)) { hookStatus = "outdated"; break; }
    }
    if (hookStatus === "current") {
      console.log(pc.green("  ✓ Pre-commit hook installed"));
    } else if (hookStatus === "outdated") {
      console.log(pc.yellow("  ⚠ Pre-commit hook outdated — run `vars hook` to update"));
    } else {
      console.log(pc.yellow("  ⚠ No pre-commit hook. Run `vars hook`"));
    }

    // Check .vars files
    const files = findAllVarsFiles(root);
    console.log(pc.dim(`  ${files.length} .vars file(s) found`));

    // Check for unlocked files
    const unlocked = files.filter(f => isUnlockedPath(f));
    if (unlocked.length > 0) {
      console.log(pc.yellow(`  ⚠ ${unlocked.length} file(s) unlocked`));
    }

    // Check #vars import
    const pkgPath = join(root, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.imports?.["#vars"]) {
          console.log(pc.green("  ✓ #vars import configured"));
        } else {
          console.log(pc.yellow("  ⚠ No #vars import in package.json"));
        }
      } catch {}
    }

    // Check for expiring secrets
    let expiryWarnings = 0;
    for (const filePath of files) {
      try {
        const resolved = resolveUseChain(filePath, { env: "dev" });
        for (const v of resolved.vars) {
          if (!v.metadata?.expires) continue;
          const status = checkExpiry(v.metadata.expires);
          if (status.expired) {
            console.log(pc.red(`  ✗ ${formatExpiryMessage(v.flatName, status, v.metadata.expires)}`));
            expiryWarnings++;
            issues++;
          } else if (status.expiringSoon) {
            console.log(pc.yellow(`  ⚠ ${formatExpiryMessage(v.flatName, status, v.metadata.expires)}`));
            expiryWarnings++;
          }
        }
      } catch { /* skip unresolvable files */ }
    }
    if (expiryWarnings === 0 && files.length > 0) {
      console.log(pc.green("  ✓ No secrets expiring soon"));
    }

    if (issues === 0) {
      console.log(pc.green("\n  All good!"));
    } else {
      console.log(pc.red(`\n  ${issues} issue(s) found`));
    }
  },
});
