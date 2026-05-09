import { readFileSync } from "node:fs";

export function readPackageVersion(entrypointUrl: string): string {
	const packageJsonUrl = new URL("../package.json", entrypointUrl);
	const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };

	if (typeof packageJson.version !== "string") {
		throw new Error("dotvars package.json is missing a version");
	}

	return packageJson.version;
}
