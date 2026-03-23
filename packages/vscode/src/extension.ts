import * as path from "node:path";
import * as cp from "node:child_process";
import { type ExtensionContext, Uri, commands, window, workspace } from "vscode";
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
	const serverModule = context.asAbsolutePath(
		path.join("dist", "server.js"),
	);

	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.stdio,
		},
		debug: {
			module: serverModule,
			transport: TransportKind.stdio,
			options: {
				execArgv: ["--nolazy", "--inspect=6009"],
			},
		},
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "vars" }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher("**/*.vars"),
		},
	};

	client = new LanguageClient(
		"varsLanguageServer",
		"Vars Language Server",
		serverOptions,
		clientOptions,
	);

	client.start();

	// --- vars commands with PIN dialog ---
	for (const cmd of ["toggle", "show", "hide"] as const) {
		const disposable = commands.registerCommand(`vars.${cmd}`, async () => {
			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				window.showErrorMessage("vars: No workspace folder open.");
				return;
			}

			const pin = await window.showInputBox({
				prompt: "Enter your vars PIN",
				password: true,
				placeHolder: "PIN",
			});

			if (!pin) return;

			try {
				await runVarsWithPin(cmd, pin, workspaceFolder.uri.fsPath);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes("Invalid PIN")) {
					window.showErrorMessage("vars: Invalid PIN.");
				} else {
					window.showErrorMessage(`vars ${cmd}: ${msg}`);
				}
			}
		});
		context.subscriptions.push(disposable);
	}

	// --- File watcher for auto-regen on save ---
	const watcher = workspace.createFileSystemWatcher("**/*.vars");

	let regenTimer: ReturnType<typeof setTimeout> | undefined;
	watcher.onDidChange(async (uri) => {
		if (regenTimer) clearTimeout(regenTimer);
		regenTimer = setTimeout(() => {
			const cwd = path.dirname(uri.fsPath);
			cp.execFile("vars", ["gen"], { cwd, timeout: 5000 }, () => {});
		}, 500);
	});

	// --- Auto-switch editor tab on .vars ↔ .unlocked.vars rename ---
	// When hide/show renames a file, open the new file and close the stale tab
	watcher.onDidCreate(async (newUri) => {
		const newPath = newUri.fsPath;
		const isUnlocked = newPath.endsWith(".unlocked.vars");
		const oldPath = isUnlocked
			? newPath.replace(/\.unlocked\.vars$/, ".vars")
			: newPath.replace(/\.vars$/, ".unlocked.vars");

		// Only act if the old counterpart was open in an editor tab
		const staleTab = window.tabGroups.all
			.flatMap(g => g.tabs)
			.find(t => (t.input as { uri?: Uri })?.uri?.fsPath === oldPath);
		if (!staleTab) return;

		const doc = await workspace.openTextDocument(newUri);
		await window.showTextDocument(doc, { preview: false });
		// Close the stale tab pointing to the now-deleted file
		await window.tabGroups.close(staleTab);
	});

	context.subscriptions.push(watcher);
}

function runVarsWithPin(subcommand: string, pin: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = cp.spawn("vars", [subcommand], {
			cwd,
			env: { ...process.env, VARS_PIN: pin },
		});

		let stderr = "";
		child.stderr.on("data", (data) => { stderr += data.toString(); });

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(stderr.trim() || `vars ${subcommand} exited with code ${code}`));
			}
		});

		child.on("error", (err) => {
			reject(new Error(`Failed to run vars: ${err.message}`));
		});
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
