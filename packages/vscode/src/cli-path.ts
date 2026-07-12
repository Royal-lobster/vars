import { constants, accessSync, realpathSync, statSync } from "node:fs";
import * as path from "node:path";

type PathApi = Pick<typeof path, "isAbsolute" | "relative" | "sep">;

export function isPathInside(root: string, candidate: string, pathApi: PathApi = path): boolean {
	const relative = pathApi.relative(root, candidate);
	return (
		relative === "" ||
		(!relative.startsWith(`..${pathApi.sep}`) && relative !== ".." && !pathApi.isAbsolute(relative))
	);
}

export function resolveCliPath(configuredPath: unknown, workspacePaths: string[]): string {
	if (typeof configuredPath !== "string" || !path.isAbsolute(configuredPath)) {
		throw new Error(
			"Set vars.cli.path globally to the absolute path of your trusted vars executable.",
		);
	}

	const resolved = realpathSync(configuredPath);
	if (!statSync(resolved).isFile()) throw new Error("vars.cli.path must point to a file.");
	accessSync(resolved, constants.X_OK);
	if (workspacePaths.some((root) => isPathInside(realpathSync(root), resolved))) {
		throw new Error("vars.cli.path must point outside the workspace.");
	}
	return resolved;
}
