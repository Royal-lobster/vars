import { accessSync, constants, realpathSync, statSync } from "node:fs";
import * as path from "node:path";

export function resolveCliPath(configuredPath: unknown, workspacePaths: string[]): string {
	if (typeof configuredPath !== "string" || !path.isAbsolute(configuredPath)) {
		throw new Error(
			"Set vars.cli.path globally to the absolute path of your trusted vars executable.",
		);
	}

	const resolved = realpathSync(configuredPath);
	if (!statSync(resolved).isFile()) throw new Error("vars.cli.path must point to a file.");
	accessSync(resolved, constants.X_OK);
	if (
		workspacePaths.some(
			(root) => path.relative(realpathSync(root), resolved).split(path.sep)[0] !== "..",
		)
	) {
		throw new Error("vars.cli.path must point outside the workspace.");
	}
	return resolved;
}
