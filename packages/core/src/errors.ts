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
    super(`${filePath ?? ".vars"}:${line}: ${message}`);
    this.name = "ParseError";
  }
}

export class ValidationError extends VarsError {
  constructor(
    message: string,
    public readonly errors: ValidationIssue[],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationIssue {
  variable: string;
  env?: string;
  expected?: string;
  got?: string;
  message: string;
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

export class ExtendsError extends VarsError {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = "ExtendsError";
  }
}
