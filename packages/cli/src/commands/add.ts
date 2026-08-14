import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { parse } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { createKeyLoader, findVarsFile, KEY_CREDENTIAL_ARGUMENTS } from "../utils/context.js";
import { collectMutationValues } from "../utils/mutation-values.js";
import { mutateVarsFile } from "../utils/vars-source-mutation.js";

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
			values = collectMutationValues(args, envs, { broadcastShared: true, required: false });
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
			{ getKey: createKeyLoader(file, "vars add", args) },
		);
		const encryption = result.encrypted ? " and encrypted" : "";
		console.log(pc.green(`  ✓ Added ${args.name}${encryption} in ${file}`));
	},
});
