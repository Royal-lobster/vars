import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	noExternal: ["@dotvars/core", "@dotvars/node"],
	external: ["argon2", "keytar"],
	banner: {
		js: "#!/usr/bin/env node",
	},
});
