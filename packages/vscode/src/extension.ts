import * as path from "node:path";
import * as cp from "node:child_process";
import { type ExtensionContext, commands, window, workspace, Uri, ViewColumn } from "vscode";
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
			fileEvents: workspace.createFileSystemWatcher("**/.vars{,.unlocked}"),
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

			if (!pin) return; // user cancelled

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

	// --- File watcher for show/hide tab swapping ---
	const watcher = workspace.createFileSystemWatcher("**/.vars.unlocked");

	watcher.onDidCreate(async (uri) => {
		const varsUri = Uri.file(uri.fsPath.replace(/\.unlocked$/, ""));
		await closeEditorByUri(varsUri);
		await openFileInEditor(uri);
	});

	watcher.onDidDelete(async (uri) => {
		const varsUri = Uri.file(uri.fsPath.replace(/\.unlocked$/, ""));
		await closeEditorByUri(uri);
		await openFileInEditor(varsUri);
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

async function closeEditorByUri(uri: Uri): Promise<void> {
	for (const tabGroup of window.tabGroups.all) {
		for (const tab of tabGroup.tabs) {
			const tabUri = (tab.input as { uri?: Uri })?.uri;
			if (tabUri && tabUri.fsPath === uri.fsPath) {
				await window.tabGroups.close(tab);
				return;
			}
		}
	}
}

async function openFileInEditor(uri: Uri): Promise<void> {
	try {
		const doc = await workspace.openTextDocument(uri);
		await window.showTextDocument(doc, ViewColumn.Active);
	} catch {
		// File might not exist yet (race condition with rename)
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
