/** Convert a canonical .vars path to its .unlocked.vars counterpart */
export function toUnlockedPath(filePath: string): string {
	return filePath.replace(/\.vars$/, ".unlocked.vars");
}

/** Convert an .unlocked.vars path back to the canonical .vars path */
export function toLockedPath(filePath: string): string {
	return filePath.replace(/\.unlocked\.vars$/, ".vars");
}

/** Check if a path is an unlocked variant */
export function isUnlockedPath(filePath: string): boolean {
	return filePath.endsWith(".unlocked.vars");
}

/** Normalize any .vars path to its canonical (locked) form */
export function toCanonicalPath(filePath: string): string {
	return isUnlockedPath(filePath) ? toLockedPath(filePath) : filePath;
}

/** Convert any .vars path (locked or unlocked) to its .local.vars counterpart */
export function toLocalPath(filePath: string): string {
	return toCanonicalPath(filePath).replace(/\.vars$/, ".local.vars");
}

/** Check if a path is a local override variant */
export function isLocalPath(filePath: string): boolean {
	return filePath.endsWith(".local.vars");
}
