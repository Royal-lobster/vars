import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { parse } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile, KEY_CREDENTIAL_ARGUMENTS } from "../utils/context.js";
import { mutateVarsFile, readValueFile } from "../utils/locked-mutation.js";

export default defineCommand({
	meta: { name: "add", description: "Add a variable without unlocking the vars file" },
	args: {
		name: {
			type: "positional",
			required: true,
			description: "Variable target (NAME or group.NAME)",
		},
		file: { type: "string", alias: "f" },
		public: { type: "boolean", description: "Keep the value plaintext in the repository" },
		schema: { type: "string", alias: "s", description: "Zod schema (e.g. z.string().url())" },
		value: { type: "string", alias: "v", description: "Value for every environment" },
		"value-file": { type: "string", description: "Read the value from a file" },
		dev: { type: "string", description: "Value for dev" },
		staging: { type: "string", description: "Value for staging" },
		prod: { type: "string", description: "Value for prod" },
		"dev-file": { type: "string", description: "Read the dev value from a file" },
		"staging-file": { type: "string", description: "Read the staging value from a file" },
		"prod-file": { type: "string", description: "Read the prod value from a file" },
		...KEY_CREDENTIAL_ARGUMENTS,
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) throw new Error("No .vars file found");
		const parsed = parse(readFileSync(file, "utf8"), file);
		const envs = parsed.ast.envs.length > 0 ? parsed.ast.envs : ["default"];
		const nonInteractive =
			!process.stdin.isTTY ||
			args.public !== undefined ||
			args.schema ||
			args.value ||
			args["value-file"] ||
			envs.some((env) => args[env] || args[`${env}-file`]);

		let isPublic: boolean;
		let schema: string;
		let values: Record<string, string>;
		if (nonInteractive) {
			isPublic = args.public === true;
			schema = args.schema || "z.string()";
			values = collectValues(args, envs);
		} else {
			const publicAnswer = await prompts.confirm({
				message: "Is this public (repository-readable)?",
			});
			if (prompts.isCancel(publicAnswer)) process.exit(0);
			isPublic = publicAnswer;
			const schemaAnswer = await prompts.text({
				message: "Zod schema:",
				placeholder: "z.string()",
				defaultValue: "z.string()",
			});
			if (prompts.isCancel(schemaAnswer)) process.exit(0);
			schema = schemaAnswer;
			values = {};
			for (const env of envs) {
				const answer = await prompts.text({ message: `Value for ${env} (or skip):` });
				if (prompts.isCancel(answer)) process.exit(0);
				if (answer) values[env] = answer;
			}
		}

		const result = await mutateVarsFile(
			file,
			{ kind: "add", target: args.name, public: isPublic, schema, values },
			{ pin: args.pin, pinFile: args["pin-file"], keyFile: args["key-file"] },
		);
		const encryption = result.encrypted ? " and encrypted" : "";
		console.log(pc.green(`  ✓ Added ${args.name}${encryption} in ${file}`));
	},
});

function collectValues(args: Record<string, unknown>, envs: string[]): Record<string, string> {
	if (args.value && args["value-file"]) throw new Error("Use either --value or --value-file");
	const values: Record<string, string> = {};
	const shared = args["value-file"] ? readValueFile(String(args["value-file"])) : args.value;
	if (shared !== undefined) {
		if (envs.length <= 1) values.default = String(shared);
		else for (const env of envs) values[env] = String(shared);
	}
	for (const env of envs) {
		const direct = args[env];
		const file = args[`${env}-file`];
		if (direct && file) throw new Error(`Use either --${env} or --${env}-file`);
		if (file) values[env] = readValueFile(String(file));
		else if (direct !== undefined) values[env] = String(direct);
	}
	return values;
}
