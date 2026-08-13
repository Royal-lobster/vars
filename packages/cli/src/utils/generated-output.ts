import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateTypeScript } from "@dotvars/core";
import { resolveAllEnvs, resolveUseChain, toCanonicalPath } from "@dotvars/node";

export type GeneratedPlatform = "node" | "serverless" | "deno" | "static";

const GENERATED_PLATFORM_RE = /^\/\/ @vars-platform: (node|serverless|deno|static)$/m;

export function detectGeneratedPlatform(filePath: string): GeneratedPlatform | null {
	const generatedPath = toCanonicalPath(filePath).replace(/\.vars$/, ".generated.ts");
	if (!existsSync(generatedPath)) return null;
	const content = readFileSync(generatedPath, "utf8");
	const match = content.match(GENERATED_PLATFORM_RE);
	return (match?.[1] as GeneratedPlatform | undefined) ?? null;
}

export function generateForFileOrThrow(filePath: string, platform: string): string {
	let code: string;
	if (platform === "serverless") {
		const byEnv = resolveAllEnvs(filePath);
		const envNames = Object.keys(byEnv);
		const ref = byEnv[envNames[0]];
		code = generateTypeScript(ref, { platform: "serverless", byEnv });
	} else {
		const resolved = resolveUseChain(filePath, { env: "dev" });
		code = generateTypeScript(resolved, {
			platform: platform as GeneratedPlatform,
		});
	}
	const outPath = toCanonicalPath(filePath).replace(/\.vars$/, ".generated.ts");
	writeFileSync(outPath, code);
	return outPath;
}
