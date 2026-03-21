import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Redacted } from "./redacted.js";
import { generateTypes } from "./codegen.js";
import { parse } from "./parser.js";

/**
 * Extract the underlying value from a possibly-Redacted wrapper or primitive.
 * Uses Redacted.unwrap() for proper secret extraction.
 */
export function extractValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (value instanceof Redacted) {
		return String(value.unwrap());
	}
	return String(value);
}

/**
 * Read the decryption key from a varskey file if it exists.
 */
export function readKeyFile(envFile: string): string | undefined {
	const keyPath = resolve(process.cwd(), "varskey");
	if (existsSync(keyPath)) {
		return readFileSync(keyPath, "utf8").trim();
	}
	return undefined;
}

/**
 * Regenerate vars.generated.ts if the .vars file is newer than the generated file.
 */
export function regenerateIfStale(envFilePath: string, envFile: string): void {
	if (!existsSync(envFilePath)) return;

	const generatedPath = resolve(dirname(envFilePath), "vars.generated.ts");
	const varsModified = statSync(envFilePath).mtimeMs;

	if (existsSync(generatedPath)) {
		const genModified = statSync(generatedPath).mtimeMs;
		if (genModified >= varsModified) return; // up to date
	}

	// Parse and regenerate
	const content = readFileSync(envFilePath, "utf8");
	const parsed = parse(content);
	const generated = generateTypes(parsed, envFile);
	writeFileSync(generatedPath, generated, "utf8");
}
