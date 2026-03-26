import { buildHeaderComment } from "./build-header-comment.js";
import { ALL_PUBLIC_PREFIXES } from "./detect-framework.js";

/**
 * Parse a .env file into key-value entries, handling:
 * - `export` prefix stripping
 * - Multiline quoted values
 * - Inline comments on unquoted values
 * - Last-wins semantics for duplicate keys
 */
function parseDotenv(envContent: string): Map<string, { value: string; quoted: boolean }> {
	const entries = new Map<string, { value: string; quoted: boolean }>();
	const lines = envContent.split("\n");
	let i = 0;

	while (i < lines.length) {
		const raw = lines[i];
		const trimmed = raw.trim();
		i++;

		if (!trimmed || trimmed.startsWith("#")) continue;

		// Strip leading `export `
		const stripped = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;

		const eqIdx = stripped.indexOf("=");
		if (eqIdx === -1) continue;

		const key = stripped.slice(0, eqIdx).trim();
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
			console.warn(`  Skipping invalid variable name: ${key}`);
			continue;
		}

		let value = stripped.slice(eqIdx + 1).trim();

		// Handle multiline quoted values (double quotes only)
		if (value.startsWith('"') && !value.endsWith('"')) {
			// Opening quote without closing — accumulate lines until closing quote
			const parts = [value.slice(1)]; // strip opening quote
			while (i < lines.length) {
				const next = lines[i];
				i++;
				if (next.includes('"')) {
					// Found the closing quote
					const closeIdx = next.indexOf('"');
					parts.push(next.slice(0, closeIdx));
					break;
				}
				parts.push(next);
			}
			entries.set(key, { value: parts.join("\n"), quoted: true });
			continue;
		}

		// Handle single-line quoted values
		let quoted = false;
		if (
			value.length >= 2 &&
			((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'")))
		) {
			value = value.slice(1, -1);
			quoted = true;
		}

		// Strip inline comments from unquoted values
		if (!quoted) {
			const commentIdx = value.indexOf(" #");
			if (commentIdx !== -1) {
				value = value.slice(0, commentIdx).trim();
			}
		}

		// Last-wins: Map.set overwrites previous entries with the same key
		entries.set(key, { value, quoted });
	}

	return entries;
}

/**
 * Convert a .env file's content into .vars format.
 * Variables matching the given public prefixes are annotated with `public`.
 */
export function migrateFromEnv(
	envContent: string,
	publicPrefixes: string[] = ALL_PUBLIC_PREFIXES,
): string {
	const detectedPrefixes = new Set<string>();
	const publicVarNames: string[] = [];
	const varLines: string[] = [];
	const entries = parseDotenv(envContent);

	for (const [key, { value, quoted }] of entries) {
		const matchedPrefix = publicPrefixes.find((p) => key.startsWith(p));
		const isPublic = !!matchedPrefix;
		if (matchedPrefix) detectedPrefixes.add(matchedPrefix);
		if (isPublic) publicVarNames.push(key);

		const pub = isPublic ? "public " : "";

		// Multiline values get triple-quoted
		if (value.includes("\n")) {
			varLines.push(`${pub}${key} = """${value}"""`);
			continue;
		}

		// Infer type only for unquoted values
		if (!quoted && /^\d+$/.test(value)) {
			varLines.push(`${pub}${key} : z.number() = ${value}`);
		} else if (!quoted && (value === "true" || value === "false")) {
			varLines.push(`${pub}${key} : z.boolean() = ${value}`);
		} else {
			varLines.push(`${pub}${key} = "${value}"`);
		}
	}

	const header = buildHeaderComment({
		source: "env",
		publicVarNames,
		totalVarCount: varLines.length,
		detectedPrefixes: [...detectedPrefixes],
	});

	const lines = [header, "env(dev, staging, prod)", "", ...varLines];

	return `${lines.join("\n")}\n`;
}
