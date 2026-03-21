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
	// The server is bundled alongside the extension
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
			fileEvents: workspace.createFileSystemWatcher("**/.vars{,.decrypted}"),
		},
	};

	client = new LanguageClient(
		"varsLanguageServer",
		"Vars Language Server",
		serverOptions,
		clientOptions,
	);

	client.start();

	// --- vars commands ---
	for (const cmd of ["toggle", "show", "hide"] as const) {
		const disposable = commands.registerCommand(`vars.${cmd}`, async () => {
			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				window.showErrorMessage("vars: No workspace folder open.");
				return;
			}

			try {
				await runVarsCommand(cmd, workspaceFolder.uri.fsPath);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg.includes("No key available")) {
					window.showErrorMessage("vars: Run 'vars unlock' in your terminal first.");
				} else {
					window.showErrorMessage(`vars ${cmd} failed: ${msg}`);
				}
			}
		});
		context.subscriptions.push(disposable);
	}

	// --- File watcher for show/hide tab swapping ---
	const watcher = workspace.createFileSystemWatcher("**/.vars.decrypted");

	watcher.onDidCreate(async (uri) => {
		const varsUri = Uri.file(uri.fsPath.replace(/\.decrypted$/, ""));
		await closeEditorByUri(varsUri);
		await openFileInEditor(uri);
	});

	watcher.onDidDelete(async (uri) => {
		const varsUri = Uri.file(uri.fsPath.replace(/\.decrypted$/, ""));
		await closeEditorByUri(uri);
		await openFileInEditor(varsUri);
	});

	context.subscriptions.push(watcher);
}

function runVarsCommand(subcommand: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		cp.exec(`vars ${subcommand}`, { cwd }, (err, _stdout, stderr) => {
			if (err) {
				reject(new Error(stderr.trim() || err.message));
			} else {
				resolve();
			}
		});
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
