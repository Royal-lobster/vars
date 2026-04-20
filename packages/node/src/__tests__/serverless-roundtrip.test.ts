import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { writeFile as writeFileAsync } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateTypeScript } from "@dotvars/core";
import { afterEach, describe, expect, it } from "vitest";
import { createMasterKey } from "../key-manager.js";
import { resolveAllEnvs } from "../resolve-multi-env.js";
import { hideFile } from "../show-hide.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve dir for esbuild bundling — pointing at @dotvars/core so `zod`
// (listed in core's dependencies) is locatable by esbuild's node-resolver.
const coreDir = resolve(__dirname, "..", "..", "..", "core");

describe("serverless round-trip", () => {
	const tmpDirs: string[] = [];
	afterEach(() => {
		for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
		tmpDirs.length = 0;
	});

	it("encrypt → codegen → eval → decrypt yields original plaintext", async () => {
		if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) return; // Node <19

		const dir = mkdtempSync(join(tmpdir(), "vars-rt-"));
		tmpDirs.push(dir);
		const file = join(dir, "config.vars");
		writeFileSync(
			file,
			`env(dev, prod)\n\npublic APP_NAME = "my-app"\nDATABASE_URL : z.string() {\n  dev = "postgres://dev"\n  prod = "postgres://prod"\n}\n`,
		);

		const key = await createMasterKey();
		await hideFile(file, key);

		const byEnv = resolveAllEnvs(file);
		const ref = byEnv[Object.keys(byEnv)[0]];
		const code = generateTypeScript(ref, { platform: "serverless", byEnv });

		// Bundle the generated TS source into a self-contained ESM .mjs so the
		// dynamic import can resolve `zod` regardless of where the tmp dir lives.
		const esbuild = await import("esbuild");
		const outPath = join(dir, "vars.mjs");
		await esbuild.build({
			stdin: {
				contents: code,
				loader: "ts",
				resolveDir: coreDir,
			},
			bundle: true,
			format: "esm",
			platform: "node",
			target: "node18",
			outfile: outPath,
			write: true,
			logLevel: "silent",
		});

		// Sanity: make sure the bundle was actually written.
		await writeFileAsync(join(dir, ".bundled"), "ok");

		const mod = await import(pathToFileURL(outPath).href);
		const vars = await mod.getVars({
			VARS_KEY: key.toString("base64"),
			VARS_ENV: "prod",
		});
		expect(vars.APP_NAME).toBe("my-app");
		expect(vars.DATABASE_URL.unwrap()).toBe("postgres://prod");
	});
});
