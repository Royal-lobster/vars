import {
	appendFileSync,
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { generateTypeScript } from "@dotvars/core";
import {
	createMasterKey,
	encryptMasterKey,
	encryptVarsContent,
	resolveUseChain,
	toUnlockedPath,
} from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { buildHeaderComment } from "../utils/build-header-comment.js";
import {
	getGitRoot,
	getProjectRoot,
	PIN_ARGUMENT,
	PIN_FILE_ARGUMENT,
	resolveSuppliedPin,
} from "../utils/context.js";
import { ALL_PUBLIC_PREFIXES, detectFramework } from "../utils/detect-framework.js";
import { migrateFromEnv } from "../utils/migrate-from-env.js";
import { HOOK_MARKER, HOOK_SCRIPT, resolveHookPath } from "../utils/pre-commit-hook.js";

export default defineCommand({
	meta: { name: "init", description: "Initialize vars in the current project" },
	args: {
		pin: PIN_ARGUMENT,
		"pin-file": PIN_FILE_ARGUMENT,
	},
	async run({ args }) {
		const root = getProjectRoot();
		const keyPath = join(root, ".varskey");

		if (existsSync(keyPath)) {
			console.log(pc.yellow("  vars is already initialized (.varskey exists)"));
			return;
		}

		prompts.intro(pc.bold("vars init"));

		const suppliedPin = resolveSuppliedPin({ pin: args.pin, pinFile: args["pin-file"] });
		const lockedInitialization = suppliedPin !== undefined;
		if (!suppliedPin && !process.stdin.isTTY) {
			console.error(pc.red("vars init requires an interactive terminal, --pin, or --pin-file."));
			console.error(pc.dim("Run directly in a terminal or provide a PIN for trusted automation."));
			process.exit(1);
		}

		let pin = suppliedPin;
		if (!pin) {
			const promptedPin = await prompts.password({
				message: "Set a PIN to protect your encryption key:",
			});
			if (prompts.isCancel(promptedPin)) process.exit(0);
			const confirm = await prompts.password({ message: "Confirm PIN:" });
			if (prompts.isCancel(confirm)) process.exit(0);
			if (promptedPin !== confirm) {
				console.error(pc.red("  PINs do not match. Try again."));
				process.exit(1);
			}
			pin = promptedPin as string;
		}

		// 2. Prepare the key and initial config before publishing either one.
		const masterKey = await createMasterKey();
		const encryptedKey = await encryptMasterKey(masterKey, pin as string);

		// 3. Create a locked config for automation or an unlocked config for human editing.
		const canonicalPath = join(root, "config.vars");
		const unlockedPath = toUnlockedPath(canonicalPath);
		const configPath = lockedInitialization ? canonicalPath : unlockedPath;
		let initialContent: string | undefined;
		if (!existsSync(canonicalPath) && !existsSync(unlockedPath)) {
			const envCandidates = [".env", ".env.local", ".env.example", ".env.sample"];
			const envFile = envCandidates
				.map((file) => join(root, file))
				.find((file) => existsSync(file));
			let content: string;

			if (envFile) {
				const framework = detectFramework(root);
				const publicPrefixes = framework ? framework.publicPrefixes : ALL_PUBLIC_PREFIXES;
				if (framework) {
					const prefixMsg = publicPrefixes.length
						? `using ${publicPrefixes.join(", ")} prefix${publicPrefixes.length > 1 ? "es" : ""}`
						: "no public var prefixes";
					console.log(pc.dim(`  Detected ${framework.name} — ${prefixMsg}`));
				}
				content = migrateFromEnv(readFileSync(envFile, "utf8"), publicPrefixes);
				console.log(pc.dim("  Migrated from .env"));
			} else {
				const header = buildHeaderComment({
					source: "boilerplate",
					publicVarNames: [],
					totalVarCount: 0,
					detectedPrefixes: [],
				});
				content = `${header}
env(dev, staging, prod)

public APP_NAME = "my-app"
public PORT : z.number() = 3000
DATABASE_URL = "postgres://user:pass@localhost:5432/mydb"
`;
			}
			initialContent = lockedInitialization
				? await encryptVarsContent(content, masterKey, "master", canonicalPath)
				: content;
		}

		publishInitialization(keyPath, configPath, encryptedKey, initialContent);

		// 4. Install zod if not already present
		const pkgJsonPath = join(root, "package.json");
		if (existsSync(pkgJsonPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
				const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
				if (!allDeps.zod) {
					// Detect package manager — in a monorepo the lock file sits at
					// the git/workspace root, not the current package.
					const lockDirs = [root, getGitRoot(root)].filter(
						(d): d is string => typeof d === "string",
					);
					const hasLock = (name: string) => lockDirs.some((d) => existsSync(join(d, name)));
					const pm = hasLock("pnpm-lock.yaml")
						? "pnpm"
						: hasLock("yarn.lock")
							? "yarn"
							: hasLock("bun.lockb") || hasLock("bun.lock")
								? "bun"
								: "npm";
					console.log(pc.dim("  Installing zod..."));
					const { execSync } = await import("node:child_process");
					execSync(`${pm} add zod --ignore-scripts`, { cwd: root, stdio: "pipe" });
				}
			} catch {
				/* non-fatal */
			}
		}

		// 5. Update .gitignore
		const gitignorePath = join(root, ".gitignore");
		const varsIgnoreEntries = "\n# vars\n.varskey\n*.unlocked.vars\n*.local.vars\n";
		if (existsSync(gitignorePath)) {
			const existing = readFileSync(gitignorePath, "utf8");
			if (!existing.includes("*.unlocked.vars")) {
				appendFileSync(gitignorePath, varsIgnoreEntries);
			} else if (!existing.includes("*.local.vars")) {
				appendFileSync(gitignorePath, "*.local.vars\n");
			}
		} else {
			writeFileSync(gitignorePath, `${varsIgnoreEntries.trim()}\n`);
		}

		// 6. Install pre-commit hook (always at git root — .git/hooks is repo-wide)
		try {
			const gitRoot = getGitRoot(root);
			if (!gitRoot) throw new Error("not a git repo");
			const hookPath = resolveHookPath(gitRoot);
			if (existsSync(hookPath)) {
				const existing = readFileSync(hookPath, "utf8");
				if (!existing.includes(HOOK_MARKER)) {
					writeFileSync(hookPath, `${existing.trimEnd()}\n${HOOK_SCRIPT}`);
				}
			} else {
				const dir = join(hookPath, "..");
				if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
				writeFileSync(hookPath, `#!/bin/sh\n${HOOK_SCRIPT}`);
			}
			chmodSync(hookPath, 0o755);
			console.log(pc.dim("  Installed pre-commit hook"));
		} catch {
			/* non-fatal — .git may not exist */
		}

		// 7. Add #vars import to package.json
		const pkgPath = join(root, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
				if (!pkg.imports?.["#vars"]) {
					pkg.imports = pkg.imports || {};
					pkg.imports["#vars"] = "./config.generated.ts";
					writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
					console.log(pc.dim("  Added #vars import to package.json"));
				}
			} catch {
				/* skip if parse fails */
			}
		}

		// 8. Generate types
		try {
			const resolved = resolveUseChain(configPath, { env: "dev" });
			const code = generateTypeScript(resolved);
			writeFileSync(canonicalPath.replace(/\.vars$/, ".generated.ts"), code);
			console.log(pc.dim("  Generated config.generated.ts"));
		} catch {
			/* non-fatal */
		}

		prompts.outro(
			pc.green(
				lockedInitialization
					? "vars initialized with config.vars locked. Use vars add/set/apply for targeted edits."
					: "vars initialized! Edit config.unlocked.vars, then run `vars hide` to encrypt.",
			),
		);
	},
});

export function publishInitialization(
	keyPath: string,
	configPath: string,
	encryptedKey: string,
	initialContent?: string,
): void {
	let keyCreated = false;
	let configCreated = false;
	try {
		writeFileSync(keyPath, `${encryptedKey}\n`, { mode: 0o600, flag: "wx" });
		keyCreated = true;
		if (initialContent !== undefined) {
			writeFileSync(configPath, initialContent, { flag: "wx" });
			configCreated = true;
		}
	} catch (error) {
		if (configCreated && existsSync(configPath)) rmSync(configPath);
		if (keyCreated && existsSync(keyPath)) rmSync(keyPath);
		throw error;
	}
}
