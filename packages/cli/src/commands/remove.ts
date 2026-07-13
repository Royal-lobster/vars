import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Declaration, parse } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import { findVarsFile } from "../utils/context.js";
import { findDeclarationEndLine } from "../utils/vars-edit.js";

export function findDeclarationLine(declarations: Declaration[], name: string): number | null {
	for (const declaration of declarations) {
		if (declaration.kind === "variable" && declaration.name === name) return declaration.line;
		if (declaration.kind === "group") {
			const variable = declaration.declarations.find((item) => item.name === name);
			if (variable) return variable.line;
		}
	}
	return null;
}

export default defineCommand({
	meta: { name: "remove", description: "Remove a variable from a .vars file" },
	args: {
		name: { type: "positional", required: true, description: "Variable name to remove" },
		file: { type: "string", alias: "f" },
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file as string) : findVarsFile(process.cwd());
		if (!file) {
			console.error(pc.red("No .vars file found"));
			process.exit(1);
		}

		const name = args.name as string;
		if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
			console.error(pc.red("Variable name must be UPPER_SNAKE_CASE"));
			process.exit(1);
		}
		const content = readFileSync(file, "utf8");
		const lines = content.split("\n");
		const line = findDeclarationLine(parse(content, file).ast.declarations, name);
		if (line === null) {
			console.error(pc.red(`  Variable "${name}" not found`));
			process.exit(1);
		}
		const start = line - 1;
		lines.splice(start, findDeclarationEndLine(content, start) - start + 1);

		// Clean up double blank lines
		const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n");
		atomicWriteFileSync(file, cleaned);
		console.log(pc.green(`  ✓ Removed ${name} from ${file}`));
	},
});
