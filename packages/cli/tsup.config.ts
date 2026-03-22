import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: false,
	clean: true,
	sourcemap: true,
	banner: { js: "#!/usr/bin/env node" },
	noExternal: ["@vars/core", "@vars/node"],
	external: ["argon2", "keytar"],
});
