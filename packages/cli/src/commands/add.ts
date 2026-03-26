import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { parse } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile } from "../utils/context.js";

function buildVariableBlock(
	name: string,
	isPublic: boolean,
	schema: string,
	values: Record<string, string>,
): string[] {
	const lines: string[] = [];
	const prefix = isPublic ? "public " : "";
	const schemaStr = schema !== "z.string()" ? ` : ${schema}` : "";

	if (Object.keys(values).length === 0) {
		lines.push(`${prefix}${name}${schemaStr}`);
	} else if (Object.keys(values).length === 1 && values.default) {
		const escaped = values.default.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
		lines.push(`${prefix}${name}${schemaStr} = "${escaped}"`);
	} else {
		lines.push(`${prefix}${name}${schemaStr} {`);
		for (const [env, val] of Object.entries(values)) {
			const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			lines.push(`  ${env} = "${escaped}"`);
		}
		lines.push("}");
	}

	return lines;
}

function parseEnvValues(args: Record<string, unknown>, envs: string[]): Record<string, string> {
	const values: Record<string, string> = {};

	// Check --value for single/default value
	if (args.value) {
		if (envs.length <= 1) {
			values.default = args.value as string;
		} else {
			// Apply --value to all envs
			for (const env of envs) {
				values[env] = args.value as string;
			}
		}
	}

	// Check --<env> flags (e.g., --dev, --staging, --prod) — override --value
	for (const env of envs) {
		if (args[env]) {
			values[env] = args[env] as string;
		}
	}

	return values;
}

export default defineCommand({
	meta: { name: "add", description: "Add a variable to a .vars file" },
	args: {
		name: { type: "positional", required: true, description: "Variable name (UPPER_SNAKE_CASE)" },
		file: { type: "string", alias: "f" },
		public: { type: "boolean", description: "Mark as public (non-secret)" },
		schema: { type: "string", alias: "s", description: "Zod schema (e.g. z.string().url())" },
		value: {
			type: "string",
			alias: "v",
			description: "Value (applies to all envs, or use --dev/--prod)",
		},
		dev: { type: "string", description: "Value for dev environment" },
		staging: { type: "string", description: "Value for staging environment" },
		prod: { type: "string", description: "Value for prod environment" },
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
		const result = parse(content, file);
		const envs = result.ast.envs.length > 0 ? result.ast.envs : ["default"];

		const isNonInteractive =
			!process.stdin.isTTY ||
			args.public !== undefined ||
			args.schema ||
			args.value ||
			args.dev ||
			args.staging ||
			args.prod;

		let isPublic: boolean;
		let schema: string;
		let values: Record<string, string>;

		if (isNonInteractive) {
			isPublic = args.public === true;
			schema = (args.schema as string) || "z.string()";
			values = parseEnvValues(args, envs);
		} else {
			const publicAnswer = await prompts.confirm({
				message: "Is this a public (non-secret) variable?",
			});
			if (prompts.isCancel(publicAnswer)) process.exit(0);
			isPublic = publicAnswer as boolean;

			const schemaAnswer = await prompts.text({
				message: "Zod schema (or press Enter for z.string()):",
				placeholder: "z.string()",
				defaultValue: "z.string()",
			});
			if (prompts.isCancel(schemaAnswer)) process.exit(0);
			schema = schemaAnswer as string;

			values = {};
			for (const env of envs) {
				const val = await prompts.text({
					message: `Value for ${env} (or skip):`,
					defaultValue: "",
				});
				if (prompts.isCancel(val)) process.exit(0);
				if (val) values[env] = val as string;
			}
		}

		const lines = buildVariableBlock(name, isPublic, schema, values);
		const newContent = `${content.trimEnd()}\n\n${lines.join("\n")}\n`;
		writeFileSync(file, newContent);
		console.log(pc.green(`  ✓ Added ${name} to ${file}`));
	},
});
