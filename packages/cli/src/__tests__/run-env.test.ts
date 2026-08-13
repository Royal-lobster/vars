import { afterEach, describe, expect, it } from "vitest";
import { childEnv } from "../commands/run.js";

describe("vars run child environment", () => {
	const originalKey = process.env.VARS_KEY;
	const originalPin = process.env.VARS_PIN;
	const originalPinFile = process.env.VARS_PIN_FILE;
	const originalKeyFile = process.env.VARS_KEY_FILE;

	afterEach(() => {
		// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
		if (originalKey === undefined) delete process.env.VARS_KEY;
		else process.env.VARS_KEY = originalKey;
		// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
		if (originalPin === undefined) delete process.env.VARS_PIN;
		else process.env.VARS_PIN = originalPin;
		// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
		if (originalPinFile === undefined) delete process.env.VARS_PIN_FILE;
		else process.env.VARS_PIN_FILE = originalPinFile;
		// biome-ignore lint/performance/noDelete: restore actual absence, not the string "undefined"
		if (originalKeyFile === undefined) delete process.env.VARS_KEY_FILE;
		else process.env.VARS_KEY_FILE = originalKeyFile;
	});

	it("strips unlock material and rejects execution-control variables", () => {
		process.env.VARS_KEY = "master";
		process.env.VARS_PIN = "pin";
		process.env.VARS_PIN_FILE = "/run/secrets/vars-pin";
		process.env.VARS_KEY_FILE = "/run/secrets/project.varskey";
		const env = childEnv({ SAFE: "value" }, "prod");
		expect(env).toMatchObject({ SAFE: "value", VARS_ENV: "prod" });
		expect(env.VARS_KEY).toBeUndefined();
		expect(env.VARS_PIN).toBeUndefined();
		expect(env.VARS_PIN_FILE).toBeUndefined();
		expect(env.VARS_KEY_FILE).toBeUndefined();

		for (const name of [
			"PATH",
			"Path",
			"Node_Options",
			"BASH_ENV",
			"LD_PRELOAD",
			"DYLD_INSERT_LIBRARIES",
		]) {
			expect(() => childEnv({ [name]: "evil" }, "prod")).toThrow(name);
		}
	});
});
