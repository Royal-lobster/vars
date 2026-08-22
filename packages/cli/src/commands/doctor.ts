import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { isUnlockedPath, resolveUseChain, toCanonicalPath } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findAllVarsFiles, findKeyFile, getGitRoot, getProjectRoot } from "../utils/context.js";
import { checkExpiry, formatExpiryMessage } from "../utils/expiry.js";
import { HOOK_MARKER, OLD_HOOK_MARKERS } from "../utils/pre-commit-hook.js";

/** Find serverless bundles whose sibling `.vars` exists but `VARS_KEY` is
 *  lacks a valid key in this shell. Returns paths relative to `root`. */
export function findOrphanedServerlessBundles(root: string): string[] {
	const envKey = process.env.VARS_KEY;
	if (
		envKey &&
		/^[A-Za-z0-9+/]+={0,2}$/.test(envKey) &&
		envKey.length % 4 === 0 &&
		Buffer.from(envKey, "base64").length === 32
	)
		return [];
	const files = findAllVarsFiles(root);
	const hits: string[] = [];
	for (const f of files) {
		const generatedPath = toCanonicalPath(f).replace(/\.vars$/, ".generated.ts");
		if (!existsSync(generatedPath)) continue;
		try {
			const content = readFileSync(generatedPath, "utf8");
			if (content.includes("@vars-platform: serverless")) {
				hits.push(relative(root, generatedPath));
			}
		} catch {
			/* skip files we can't read (perms, races) */
		}
	}
	return hits;
}

export default defineCommand({
	meta: { name: "doctor", description: "Diagnose vars setup" },
	args: {},
	async run() {
		const root = getProjectRoot();
		let issues = 0;

		// Check key. When locked files already exist, `vars key init` would mint a
		// key that cannot decrypt them — point at `vars key import` instead.
		const keyFile = findKeyFile(root);
		if (keyFile) {
			const relKeyFile = relative(root, keyFile);
			if (relKeyFile.startsWith("..")) {
				console.log(pc.green(`  ✓ Key file found (primary checkout: ${keyFile})`));
			} else {
				console.log(pc.green("  ✓ Key file found"));
			}
		} else if (findAllVarsFiles(root).some((f) => !isUnlockedPath(f))) {
			console.log(
				pc.red(
					"  ✗ No key file, but locked .vars files exist. Run `vars key import <envelope>` with the project's existing .varskey",
				),
			);
			issues++;
		} else {
			console.log(pc.red("  ✗ No key file. Run `vars key init`"));
			issues++;
		}

		// Check .gitignore
		const gitignorePath = join(root, ".gitignore");
		if (existsSync(gitignorePath)) {
			const content = readFileSync(gitignorePath, "utf8");
			if (content.includes(".varskey")) {
				console.log(pc.green("  ✓ .varskey in .gitignore"));
			} else {
				console.log(pc.red("  ✗ .varskey not in .gitignore"));
				issues++;
			}
		} else {
			console.log(pc.red("  ✗ No .gitignore found"));
			issues++;
		}

		// Check pre-commit hook — lives at git root since .git/hooks is repo-wide
		const gitRoot = getGitRoot(root);
		const hookPaths = gitRoot
			? [join(gitRoot, ".husky", "pre-commit"), join(gitRoot, ".git", "hooks", "pre-commit")]
			: [];
		let hookStatus: "current" | "outdated" | "missing" = "missing";
		for (const p of hookPaths) {
			if (!existsSync(p)) continue;
			const content = readFileSync(p, "utf8");
			if (content.includes(HOOK_MARKER)) {
				hookStatus = "current";
				break;
			}
			if (OLD_HOOK_MARKERS.some((m) => content.includes(m))) {
				hookStatus = "outdated";
				break;
			}
		}
		if (hookStatus === "current") {
			console.log(pc.green("  ✓ Pre-commit hook installed"));
		} else if (hookStatus === "outdated") {
			console.log(pc.yellow("  ⚠ Pre-commit hook outdated — run `vars init` to update"));
		} else {
			console.log(pc.yellow("  ⚠ No pre-commit hook. Run `vars init`"));
		}

		// Check .vars files
		const files = findAllVarsFiles(root);
		console.log(pc.dim(`  ${files.length} .vars file(s) found`));

		// Check for unlocked files
		const unlocked = files.filter((f) => isUnlockedPath(f));
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
				const seen = new Set<string>();
				for (const env of resolved.envs) {
					let envResolved;
					try {
						envResolved = resolveUseChain(filePath, { env });
					} catch {
						continue;
					}
					for (const v of envResolved.vars) {
						if (!v.metadata?.expires || seen.has(v.flatName)) continue;
						seen.add(v.flatName);
						const status = checkExpiry(v.metadata.expires);
						if (status.invalid) {
							console.log(
								pc.red(`  ✗ ${formatExpiryMessage(v.flatName, status, v.metadata.expires)}`),
							);
							issues++;
						} else if (status.expired) {
							console.log(
								pc.red(`  ✗ ${formatExpiryMessage(v.flatName, status, v.metadata.expires)}`),
							);
							expiryWarnings++;
							issues++;
						} else if (status.expiringSoon) {
							console.log(
								pc.yellow(`  ⚠ ${formatExpiryMessage(v.flatName, status, v.metadata.expires)}`),
							);
							expiryWarnings++;
							issues++;
						}
					}
				}
			} catch {
				/* skip unresolvable files */
			}
		}
		if (expiryWarnings === 0 && files.length > 0) {
			console.log(pc.green("  ✓ No secrets expiring soon"));
		}

		// Check for serverless bundles that need VARS_KEY in this shell.
		if (keyFile) {
			for (const rel of findOrphanedServerlessBundles(root)) {
				console.log(
					pc.yellow(
						`  ⚠ serverless bundle detected in ${rel} but VARS_KEY is not set in this shell.`,
					),
				);
				issues++;
			}
		}

		if (issues === 0) {
			console.log(pc.green("\n  All good!"));
		} else {
			console.log(pc.red(`\n  ${issues} issue(s) found`));
		}
	},
});
