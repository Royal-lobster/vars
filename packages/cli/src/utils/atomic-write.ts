import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface AtomicWriteOptions {
	mode?: number;
}

/**
 * Atomically replace a file using a collision-safe sibling temp file.
 * Existing permissions are preserved; new files use the caller's mode or the process umask.
 */
export function atomicWriteFileSync(
	filePath: string,
	content: string,
	options: AtomicWriteOptions = {},
): void {
	const mode = existsSync(filePath) ? statSync(filePath).mode & 0o777 : options.mode;
	const nonce = randomBytes(6).toString("hex");
	const tmpPath = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${nonce}.tmp`);
	try {
		writeFileSync(tmpPath, content, {
			encoding: "utf8",
			flag: "wx",
			...(mode === undefined ? {} : { mode }),
		});
		if (mode !== undefined) chmodSync(tmpPath, mode);
		renameSync(tmpPath, filePath);
	} finally {
		if (existsSync(tmpPath)) rmSync(tmpPath);
	}
}
