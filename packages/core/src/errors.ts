export class VarsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VarsError";
	}
}

export class ParseError extends VarsError {
	constructor(
		message: string,
		public readonly line: number,
		public readonly filePath?: string,
	) {
		super(`${filePath ?? "<input>"}:${line}: ${message}`);
		this.name = "ParseError";
	}
}

export class ValidationError extends VarsError {
	constructor(
		message: string,
		public readonly issues: ValidationIssue[],
	) {
		super(message);
		this.name = "ValidationError";
	}
}

export interface ValidationIssue {
	variable: string;
	message: string;
	env?: string;
}

export class CryptoError extends VarsError {
	constructor(message: string) {
		super(message);
		this.name = "CryptoError";
	}
}

export class KeyError extends VarsError {
	constructor(message: string) {
		super(message);
		this.name = "KeyError";
	}
}

export class CheckError extends VarsError {
	constructor(
		message: string,
		public readonly checkDescription: string,
		public readonly env: string,
	) {
		super(`check "${checkDescription}" failed for env ${env}: ${message}`);
		this.name = "CheckError";
	}
}
