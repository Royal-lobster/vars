import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { findVarsFile, KEY_CREDENTIAL_ARGUMENTS } from "../utils/context.js";
import { mutateVarsFile } from "../utils/vars-source-mutation.js";

export default defineCommand({
	meta: { name: "remove", description: "Remove a variable without unlocking the vars file" },
	args: {
		name: {
			type: "positional",
			required: true,
			description: "Variable target (NAME or group.NAME)",
		},
		file: { type: "string", alias: "f" },
		...KEY_CREDENTIAL_ARGUMENTS,
	},
	async run({ args }) {
		const file = args.file ? resolve(args.file) : findVarsFile(process.cwd());
		if (!file) throw new Error("No .vars file found");
		await mutateVarsFile(
			file,
			{ kind: "remove", target: args.name },
			{ pin: args.pin, pinFile: args["pin-file"], keyFile: args["key-file"] },
		);
		console.log(pc.green(`  ✓ Removed ${args.name} from ${file}`));
	},
});
