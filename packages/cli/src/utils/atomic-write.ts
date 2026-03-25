import { renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Write a file atomically by writing to a temp file first, then renaming.
 * This prevents partial writes from corrupting the target file on crash/interrupt.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
	const tmpPath = join(dirname(filePath), `.${Date.now()}.tmp`);
	writeFileSync(tmpPath, content, "utf8");
	renameSync(tmpPath, filePath);
}
