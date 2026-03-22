import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findKeyFile, findAllVarsFiles, getProjectRoot } from "../utils/context.js";
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
    const hookInstalled = hookPaths.some(p => {
      if (!existsSync(p)) return false;
      return readFileSync(p, "utf8").includes("@vars-state");
    });
    if (hookInstalled) {
      console.log(pc.green("  ✓ Pre-commit hook installed"));
    } else {
      console.log(pc.yellow("  ⚠ No pre-commit hook. Run `vars hook`"));
    }

    // Check .vars files
    const files = findAllVarsFiles(root);
    console.log(pc.dim(`  ${files.length} .vars file(s) found`));

    // Check for unlocked files
    const unlocked = files.filter(f => {
      try { return readFileSync(f, "utf8").includes("# @vars-state unlocked"); } catch { return false; }
    });
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

    if (issues === 0) {
      console.log(pc.green("\n  All good!"));
    } else {
      console.log(pc.red(`\n  ${issues} issue(s) found`));
    }
  },
});
