import * as path from "node:path";
import {
  ExtensionContext,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  // The server is the @vars/lsp package's built output
  const serverModule = context.asAbsolutePath(
    path.join("node_modules", "@vars", "lsp", "dist", "index.cjs"),
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
      // Watch for .vars file changes
      fileEvents: workspace.createFileSystemWatcher("**/.vars"),
    },
  };

  client = new LanguageClient(
    "varsLanguageServer",
    "Vars Language Server",
    serverOptions,
    clientOptions,
  );

  // Start the client, which also launches the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
