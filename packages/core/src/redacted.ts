const INSPECT = Symbol.for("nodejs.util.inspect.custom");

export class Redacted<T> {
  #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  unwrap(): T {
    return this.#value;
  }

  toString(): string {
    return "<redacted>";
  }

  toJSON(): string {
    return "<redacted>";
  }

  [INSPECT](): string {
    return "<redacted>";
  }
}
