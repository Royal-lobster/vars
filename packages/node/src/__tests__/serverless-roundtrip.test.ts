import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateTypeScript } from "@dotvars/core";
import { afterEach, describe, expect, it } from "vitest";
import { createMasterKey } from "../key-manager.js";
import { resolveAllEnvs } from "../resolve-multi-env.js";
import { hideFile } from "../show-hide.js";

// esbuild needs a resolveDir that can find "zod" when bundling the generated
// module; resolve it through @dotvars/core (which depends on zod) so the path
// is robust to monorepo layout changes.
const require = createRequire(import.meta.url);
const coreRequire = createRequire(require.resolve("@dotvars/core"));
const zodDir = dirname(coreRequire.resolve("zod/package.json"));

const hasSubtle = !!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle;

describe("serverless round-trip", () => {
	const tmpDirs: string[] = [];
	afterEach(() => {
		for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
		tmpDirs.length = 0;
	});

	it.skipIf(!hasSubtle)(
		"encrypt → codegen → eval → decrypt yields original plaintext",
		async () => {
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
			const ref = byEnv.prod;
			const code = generateTypeScript(ref, { platform: "serverless", byEnv });

			const esbuild = await import("esbuild");
			const outPath = join(dir, "vars.mjs");
			await esbuild.build({
				stdin: {
					contents: code,
					loader: "ts",
					resolveDir: zodDir,
				},
				bundle: true,
				format: "esm",
				platform: "node",
				target: "node18",
				outfile: outPath,
				write: true,
				logLevel: "silent",
			});

			const mod = await import(pathToFileURL(outPath).href);
			const vars = await mod.getVars({
				VARS_KEY: key.toString("base64"),
				VARS_ENV: "prod",
			});
			expect(vars.APP_NAME).toBe("my-app");
			expect(vars.DATABASE_URL.unwrap()).toBe("postgres://prod");
		},
	);
});
