import { readFileSync } from "node:fs";
import { parse } from "@vars/core";
import type { ParseResult } from "@vars/core";

export function readVarsFile(filePath: string): ParseResult {
	const content = readFileSync(filePath, "utf8");
	return parse(content, filePath);
}
