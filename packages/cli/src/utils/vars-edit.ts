/** Serialize a string as a valid single-line .vars literal. */
export function quoteVarsString(value: string): string {
	if ([...value].some((char) => char < " " && char !== "\n" && char !== "\r" && char !== "\t")) {
		throw new Error(
			".vars strings cannot contain control characters other than newline, tab, or carriage return",
		);
	}
	return `"${value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")}"`;
}

export function serializeVarsValue(value: string): string {
	if (value === "true" || value === "false" || /^\d+(\.\d+)?$/.test(value)) return value;
	if (isArrayLiteral(value)) return value;
	return quoteVarsString(value);
}

export function serializeVarsStringOrArray(value: string): string {
	return isArrayLiteral(value) ? value : quoteVarsString(value);
}

export function serializeParsedVarsValue(value: unknown): string {
	return serializeVarsValue(Array.isArray(value) ? JSON.stringify(value) : String(value));
}

function isArrayLiteral(value: string): boolean {
	if (!value.startsWith("[")) return false;
	try {
		return Array.isArray(JSON.parse(value));
	} catch {
		return false;
	}
}

/** Return the final balanced metadata block without reformatting it. */
export function trailingMetadata(source: string): string | null {
	let start = -1;
	let depth = 0;
	let quote = "";
	let escaped = false;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i]!;
		if (quote) {
			if (!escaped && ch === quote) quote = "";
			escaped = !escaped && ch === "\\";
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			escaped = false;
		} else if (ch === "#") {
			while (i + 1 < source.length && source[i + 1] !== "\n") i++;
		} else if (ch === "(") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === ")") depth--;
	}
	return start >= 0 && depth === 0 ? source.slice(start).trim() : null;
}

/** Find the last line occupied by a variable declaration and its metadata. */
export function findDeclarationEndLine(source: string, startLine: number): number {
	const starts = [0];
	for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
	let i = starts[startLine] ?? source.length;
	let braces = 0;
	let parens = 0;
	let brackets = 0;
	let quote = "";
	let escaped = false;
	let sawBlock = false;
	let blockClosed = false;
	let line = startLine;

	for (; i < source.length; i++) {
		const ch = source[i]!;
		if (ch === "\n") line++;
		if (quote) {
			if (quote === '"""' && source.startsWith('"""', i)) {
				quote = "";
				i += 2;
			} else if (quote !== '"""' && !escaped && ch === quote) quote = "";
			escaped = !escaped && ch === "\\";
			continue;
		}
		if (ch === "#") {
			while (i + 1 < source.length && source[i + 1] !== "\n") i++;
			continue;
		}
		if (source.startsWith('"""', i)) {
			quote = '"""';
			i += 2;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			escaped = false;
			continue;
		}
		if (ch === "{") {
			braces++;
			sawBlock = true;
		} else if (ch === "}") {
			braces--;
			if (sawBlock && braces === 0) blockClosed = true;
		} else if (ch === "(") parens++;
		else if (ch === ")") parens--;
		else if (ch === "[") brackets++;
		else if (ch === "]") brackets--;

		if (ch !== "\n" || braces || parens || brackets) continue;
		if (!sawBlock || blockClosed) {
			let next = i + 1;
			while (next < source.length) {
				while (next < source.length && /[ \t\r\n]/.test(source[next]!)) next++;
				if (source[next] !== "#") break;
				while (next < source.length && source[next] !== "\n") next++;
			}
			if (source[next] !== "(") return line - 1;
			parens = 0;
			i = next - 1;
			line = source.slice(0, next).split("\n").length - 1;
		}
	}
	return Math.max(startLine, line);
}
