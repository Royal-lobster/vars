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

			// Capture the active editor's file path before running the command
			const activeUri = window.activeTextEditor?.document.uri;

			try {
				await runVarsWithPin(cmd, pin, workspaceFolder.uri.fsPath);
				// After successful hide/show/toggle, switch editor to the renamed file
				if (activeUri && activeUri.fsPath.endsWith(".vars")) {
					const oldPath = activeUri.fsPath;
					const isUnlocked = oldPath.endsWith(".unlocked.vars");
					const newPath = isUnlocked
						? oldPath.replace(/\.unlocked\.vars$/, ".vars")
						: oldPath.replace(/\.vars$/, ".unlocked.vars");
					// Only switch if the new file exists (the rename happened)
					try {
						await workspace.fs.stat(Uri.file(newPath));
						const doc = await workspace.openTextDocument(Uri.file(newPath));
						await window.showTextDocument(doc, { preview: false });
						// Close the old tab (now pointing to a deleted file)
						const oldDoc = workspace.textDocuments.find(d => d.uri.fsPath === oldPath);
						if (oldDoc) {
							// Switch to old doc and close it
							await window.showTextDocument(oldDoc, { preview: false, preserveFocus: false });
							await commands.executeCommand("workbench.action.closeActiveEditor");
							// Re-focus the new file
							await window.showTextDocument(doc, { preview: false });
						}
					} catch {
						// New file doesn't exist — toggle may have gone the other direction, or no rename happened
					}
				}
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

	// When a new .vars or .unlocked.vars file appears (from a rename), switch the editor tab
	watcher.onDidCreate(async (uri) => {
		const newPath = uri.fsPath;
		const isUnlocked = newPath.endsWith(".unlocked.vars");
		// Determine what the old path would have been
		const oldPath = isUnlocked
			? newPath.replace(/\.unlocked\.vars$/, ".vars")
			: newPath.replace(/\.vars$/, ".unlocked.vars");
		// Check if we have the old file open in an editor tab
		const oldDoc = workspace.textDocuments.find(d => d.uri.fsPath === oldPath);
		if (!oldDoc) return;
		// The old file was open — switch to the new one
		try {
			const doc = await workspace.openTextDocument(uri);
			await window.showTextDocument(doc, { preview: false });
			// Close the stale tab
			await window.showTextDocument(oldDoc, { preview: false, preserveFocus: false });
			await commands.executeCommand("workbench.action.closeActiveEditor");
			// Re-focus the new file
			await window.showTextDocument(doc, { preview: false });
		} catch {
			// Non-fatal — file may have been transient
		}
	});

	context.subscriptions.push(watcher);
}

function runVarsWithPin(subcommand: string, pin: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = cp.spawn("vars", [subcommand], { cwd });

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

		child.stdin.write(pin + "\n");
		child.stdin.end();
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
