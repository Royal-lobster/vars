import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { createMasterKey, encryptMasterKey, parseKeyFile } from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	getProjectRoot,
	KEY_CREDENTIAL_ARGUMENTS,
	PIN_ARGUMENT,
	PIN_FILE_ARGUMENT,
	requireKey,
	resolveKeyFile,
	resolveSuppliedPin,
} from "../utils/context.js";

export default defineCommand({
	meta: { name: "key", description: "Manage encryption keys" },
	subCommands: {
		init: defineCommand({
			meta: { name: "init", description: "Create a new encryption key" },
			args: {
				pin: PIN_ARGUMENT,
				"pin-file": PIN_FILE_ARGUMENT,
			},
			async run({ args }) {
				const suppliedPin = resolveSuppliedPin({ pin: args.pin, pinFile: args["pin-file"] });
				if (!suppliedPin && !process.stdin.isTTY) {
					console.error("This command requires an interactive terminal, --pin, or --pin-file.");
					process.exit(1);
				}
				const root = getProjectRoot();
				const keyPath = join(root, ".varskey");
				if (existsSync(keyPath)) {
					console.log(pc.yellow("  Key already exists at .varskey"));
					return;
				}
				let pin = suppliedPin;
				if (!pin) {
					const promptedPin = await prompts.password({ message: "Set a PIN:" });
					if (prompts.isCancel(promptedPin)) process.exit(0);
					const confirm = await prompts.password({ message: "Confirm PIN:" });
					if (prompts.isCancel(confirm)) process.exit(0);
					if (promptedPin !== confirm) {
						console.error(pc.red("PINs do not match"));
						process.exit(1);
					}
					pin = promptedPin as string;
				}
				const key = await createMasterKey();
				const encrypted = await encryptMasterKey(key, pin as string);
				writeFileSync(keyPath, `${encrypted}\n`);
				console.log(pc.green("  ✓ Key created at .varskey"));
			},
		}),
		export: defineCommand({
			meta: {
				name: "export",
				description: "Print raw base64 master key (compatibility escape hatch)",
			},
			args: {
				...KEY_CREDENTIAL_ARGUMENTS,
			},
			async run({ args }) {
				const keyFile = resolveKeyFile(process.cwd(), args["key-file"]);
				if (!keyFile) {
					console.error(pc.red("No key found"));
					process.exit(1);
				}
				const { key, scope } = await requireKey(keyFile, "vars key export", {
					pin: args.pin,
					pinFile: args["pin-file"],
					preferEnvelope: typeof args["key-file"] === "string",
				});
				if (scope !== "master") {
					console.error(pc.red("  Only the master PIN can export the key."));
					process.exit(1);
				}
				console.log(key.toString("base64"));
			},
		}),
		import: defineCommand({
			meta: { name: "import", description: "Import an encrypted .varskey envelope" },
			args: {
				source: {
					type: "positional",
					required: true,
					description: "Encrypted key envelope path",
				},
			},
			async run({ args }) {
				const root = getProjectRoot();
				const destination = join(root, ".varskey");
				if (existsSync(destination)) {
					console.error(pc.red("A .varskey envelope already exists in this project."));
					process.exit(1);
				}
				const source = resolve(args.source);
				const content = readFileSync(source, "utf8").trim();
				if (parseKeyFile(content).length === 0) {
					console.error(pc.red(`No valid key entries found in ${source}`));
					process.exit(1);
				}
				writeFileSync(destination, `${content}\n`, { mode: 0o600, flag: "wx" });
				console.log(pc.green(`  ✓ Imported encrypted key envelope → ${destination}`));
			},
		}),
	},
});
