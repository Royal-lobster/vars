import { readFileSync } from "node:fs";
import * as prompts from "@clack/prompts";
import { parse } from "@dotvars/core";
import {
	decryptVarsContent,
	deriveOwnerKey,
	encryptMasterKey,
	encryptVarsContent,
	isUnlockedPath,
	parseKeyFile,
} from "@dotvars/node";
import { defineCommand } from "citty";
import pc from "picocolors";
import { atomicWriteFileSync } from "../utils/atomic-write.js";
import {
	findAllVarsFiles,
	getProjectRoot,
	KEY_CREDENTIAL_ARGUMENTS,
	NEW_PIN_ARGUMENT,
	NEW_PIN_FILE_ARGUMENT,
	requireKey,
	resolveExplicitPin,
	resolveKeyFile,
} from "../utils/context.js";

export default defineCommand({
	meta: { name: "pin", description: "Manage owner PINs" },
	subCommands: {
		create: defineCommand({
			meta: { name: "create", description: "Create a PIN for an owner" },
			args: {
				owner: {
					type: "positional",
					required: true,
					description: "Owner name (e.g., backend-team)",
				},
				...KEY_CREDENTIAL_ARGUMENTS,
				"new-pin": NEW_PIN_ARGUMENT,
				"new-pin-file": NEW_PIN_FILE_ARGUMENT,
			},
			async run({ args }) {
				const newPin = resolveExplicitPin({
					pin: args["new-pin"],
					pinFile: args["new-pin-file"],
				});
				if (!newPin && !process.stdin.isTTY) {
					console.error("Provide --new-pin or --new-pin-file for non-interactive use.");
					process.exit(1);
				}

				const keyFile = resolveKeyFile(process.cwd(), args["key-file"]);
				if (!keyFile) {
					console.error(pc.red("No key found. Run `vars init` first."));
					process.exit(1);
				}

				const owner = args.owner as string;

				// Validate owner name (no colons or special chars that would corrupt token format)
				if (!/^[A-Za-z0-9_-]+$/.test(owner)) {
					console.error(
						pc.red("  Owner name may only contain letters, digits, hyphens, and underscores."),
					);
					process.exit(1);
				}

				// Check if owner entry already exists
				const keyContent = readFileSync(keyFile, "utf8").trim();
				const entries = parseKeyFile(keyContent);
				const existing = entries.find((e) => e.scope === `owner:${owner}`);
				if (existing) {
					console.error(pc.red(`  PIN for owner "${owner}" already exists in .varskey`));
					process.exit(1);
				}

				// Require master PIN
				console.log(pc.dim("  Authenticate with master PIN to create owner PIN"));
				const { key: masterKey, scope } = await requireKey(keyFile, `vars pin create ${owner}`, {
					pin: args.pin,
					pinFile: args["pin-file"],
					preferEnvelope: typeof args["key-file"] === "string",
				});
				if (scope !== "master") {
					console.error(pc.red("  Owner PINs cannot create other owner PINs. Use the master PIN."));
					process.exit(1);
				}

				// Derive owner sub-key
				const ownerKey = await deriveOwnerKey(masterKey, owner);

				// Set owner PIN
				let ownerPin = newPin;
				if (!ownerPin) {
					const promptedPin = await prompts.password({ message: `Set PIN for ${owner}:` });
					if (prompts.isCancel(promptedPin)) process.exit(0);
					const confirm = await prompts.password({ message: "Confirm PIN:" });
					if (prompts.isCancel(confirm)) process.exit(0);
					if (promptedPin !== confirm) {
						console.error(pc.red("  PINs do not match"));
						process.exit(1);
					}
					ownerPin = promptedPin as string;
				}

				// Wrap owner key with PIN
				const encryptedOwnerKey = await encryptMasterKey(ownerKey, ownerPin, owner);

				// Prepare every owner-field migration in memory. Never create an unlocked file.
				const root = getProjectRoot();
				const files = findAllVarsFiles(root);
				const updates = new Map<string, { original: string; updated: string }>();
				for (const file of files) {
					const content = readFileSync(file, "utf8");
					const parsed = parse(content, file);
					const hasOwner = parsed.ast.declarations.some((declaration) => {
						if (declaration.kind === "variable") return declaration.metadata?.owner === owner;
						if (declaration.kind === "group") {
							return declaration.declarations.some(
								(variable) => variable.metadata?.owner === owner,
							);
						}
						return false;
					});
					if (hasOwner && !isUnlockedPath(file)) {
						const plaintext = await decryptVarsContent(content, masterKey, "master");
						const updated = await encryptVarsContent(plaintext, masterKey, "master", file);
						updates.set(file, { original: content, updated });
					}
				}

				try {
					for (const [file, update] of updates) {
						atomicWriteFileSync(file, update.updated);
					}
					// Publish the PIN only after every owner field is safely migrated.
					atomicWriteFileSync(keyFile, `${keyContent}\n${encryptedOwnerKey}\n`);
				} catch (error) {
					for (const [file, update] of updates) {
						atomicWriteFileSync(file, update.original);
					}
					throw error;
				}

				console.log(pc.green(`  ✓ PIN created for owner "${owner}"`));
				if (updates.size > 0) {
					console.log(pc.dim(`  Re-encrypted ${updates.size} file(s) with owner-scoped keys`));
				}
				console.log(
					pc.dim(
						"  Share the PIN with the owner for targeted vars commands; show/hide remain available for human editing.",
					),
				);
			},
		}),
	},
});
