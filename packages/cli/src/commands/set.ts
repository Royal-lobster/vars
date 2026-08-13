import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@dotvars/core";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile, KEY_CREDENTIAL_ARGUMENTS } from "../utils/context.js";
import { mutateVarsFile, readValueFile } from "../utils/vars-source-mutation.js";

export default defineCommand({
	meta: { name: "set", description: "Update a variable without unlocking the vars file" },
	args: {
		name: {
			type: "positional",
			required: true,
			description: "Variable target (NAME or group.NAME)",
		},
		file: { type: "string", alias: "f" },
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
		const values = collectValues(args, envs);
		const result = await mutateVarsFile(
			file,
			{ kind: "set", target: args.name, values },
			{ pin: args.pin, pinFile: args["pin-file"], keyFile: args["key-file"] },
		);
		const encryption = result.encrypted ? " and encrypted" : "";
		console.log(pc.green(`  ✓ Updated ${args.name}${encryption} in ${file}`));
	},
});

function collectValues(args: Record<string, unknown>, envs: string[]): Record<string, string> {
	if (args.value && args["value-file"]) throw new Error("Use either --value or --value-file");
	const values: Record<string, string> = {};
	const shared = args["value-file"] ? readValueFile(String(args["value-file"])) : args.value;
	if (shared !== undefined) values.default = String(shared);
	for (const env of envs) {
		const direct = args[env];
		const file = args[`${env}-file`];
		if (direct && file) throw new Error(`Use either --${env} or --${env}-file`);
		if (file) values[env] = readValueFile(String(file));
		else if (direct !== undefined) values[env] = String(direct);
	}
	if (Object.keys(values).length === 0) throw new Error("Provide --value or an environment value");
	return values;
}
