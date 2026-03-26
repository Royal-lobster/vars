import { readFileSync } from "node:fs";
import { parse } from "@dotvars/core";
import type { ParseResult } from "@dotvars/core";

export function readVarsFile(filePath: string): ParseResult {
	const content = readFileSync(filePath, "utf8");
	return parse(content, filePath);
}
