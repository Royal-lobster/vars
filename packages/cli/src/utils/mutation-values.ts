import { readFileSync } from "node:fs";

export interface MutationValueOptions {
	broadcastShared: boolean;
	required: boolean;
}

const RESERVED_ENV_NAMES = new Set([
	"name",
	"file",
	"public",
	"schema",
	"value",
	"value-file",
	"pin",
	"pin-file",
	"key",
	"key-file",
]);

export function collectMutationValues(
	args: Record<string, unknown>,
	envs: string[],
	options: MutationValueOptions,
): Record<string, string> {
	const collision = envs.find((env) => RESERVED_ENV_NAMES.has(env));
	if (collision) {
		throw new Error(`Environment name "${collision}" conflicts with a vars command flag`);
	}
	if (args.value !== undefined && args["value-file"] !== undefined) {
		throw new Error("Use either --value or --value-file");
	}

	const values: Record<string, string> = {};
	const shared =
		args["value-file"] !== undefined ? readValueFile(String(args["value-file"])) : args.value;
	if (shared !== undefined) {
		if (options.broadcastShared && envs.length > 1) {
			for (const env of envs) values[env] = String(shared);
		} else {
			values.default = String(shared);
		}
	}

	for (const env of envs) {
		const direct = args[env];
		const file = args[`${env}-file`];
		if (direct !== undefined && file !== undefined) {
			throw new Error(`Use either --${env} or --${env}-file`);
		}
		if (file !== undefined) values[env] = readValueFile(String(file));
		else if (direct !== undefined) values[env] = String(direct);
	}

	if (options.required && Object.keys(values).length === 0) {
		throw new Error("Provide --value or an environment value");
	}
	return values;
}

export function readValueFile(path: string): string {
	const value = readFileSync(path, "utf8");
	return value.replace(/\r?\n$/, "");
}
