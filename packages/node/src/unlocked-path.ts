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
