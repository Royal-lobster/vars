import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		extension: "src/extension.ts",
		server: "src/server.ts",
	},
	format: ["cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	external: ["vscode"],
	noExternal: ["@vars/lsp", "vscode-languageserver", "vscode-languageserver-textdocument", "vscode-languageclient"],
});
