import * as path from "node:path";
import * as cp from "node:child_process";
import { type ExtensionContext, commands, window, workspace } from "vscode";
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
	TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

/** Read the @vars-state header from a .vars document and set the context key */
function updateVarsState(doc: { languageId: string; getText(): string }): void {
	if (doc.languageId !== "vars") return;
	const firstLine = doc.getText().split("\n", 1)[0] ?? "";
	if (firstLine.includes("@vars-state unlocked")) {
		commands.executeCommand("setContext", "vars.state", "unlocked");
	} else if (firstLine.includes("@vars-state locked")) {
		commands.executeCommand("setContext", "vars.state", "locked");
	} else {
		commands.executeCommand("setContext", "vars.state", undefined);
	}
}

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

	// --- Track @vars-state for editor title buttons ---
	if (window.activeTextEditor) {
		updateVarsState(window.activeTextEditor.document);
	}
	context.subscriptions.push(
		window.onDidChangeActiveTextEditor((editor) => {
			if (editor) updateVarsState(editor.document);
		}),
		workspace.onDidChangeTextDocument((e) => {
			if (window.activeTextEditor?.document === e.document) {
				updateVarsState(e.document);
			}
		}),
	);

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

			if (!pin) return; // user cancelled

			try {
				await runVarsWithPin(cmd, pin, workspaceFolder.uri.fsPath);
				// Refresh the active editor to pick up file changes and update state
				if (window.activeTextEditor) {
					const doc = window.activeTextEditor.document;
					await commands.executeCommand("workbench.action.files.revert");
					updateVarsState(doc);
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
		// Update state if the changed file is currently open
		if (window.activeTextEditor?.document.uri.fsPath === uri.fsPath) {
			updateVarsState(window.activeTextEditor.document);
		}
		// Debounce — wait 500ms after last save before regenerating
		if (regenTimer) clearTimeout(regenTimer);
		regenTimer = setTimeout(() => {
			const cwd = path.dirname(uri.fsPath);
			cp.execFile("vars", ["gen"], { cwd, timeout: 5000 }, () => {
				// Silently ignore errors — gen may fail if schemas are mid-edit
			});
		}, 500);
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

		// Write PIN to stdin and close it
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
