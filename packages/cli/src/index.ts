import { defineCommand, runMain } from "citty";

const main = defineCommand({
	meta: {
		name: "vars",
		version: "0.1.0",
		description: "Encrypted, typed, schema-first environment variables",
	},
	// subCommands added in Plan 2
});

runMain(main);
