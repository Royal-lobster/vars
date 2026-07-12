import { z } from "zod";

const ALLOWED_ZOD_METHODS = new Set([
	"string",
	"number",
	"boolean",
	"bigint",
	"date",
	"symbol",
	"undefined",
	"null",
	"void",
	"any",
	"unknown",
	"never",
	"array",
	"object",
	"tuple",
	"record",
	"map",
	"set",
	"union",
	"intersection",
	"discriminatedUnion",
	"optional",
	"nullable",
	"nullish",
	"default",
	"catch",
	"pipe",
	"brand",
	"min",
	"max",
	"length",
	"email",
	"url",
	"uuid",
	"startsWith",
	"endsWith",
	"includes",
	"trim",
	"toLowerCase",
	"toUpperCase",
	"int",
	"positive",
	"negative",
	"nonnegative",
	"nonpositive",
	"finite",
	"safe",
	"multipleOf",
	"step",
	"enum",
	"literal",
]);
const COERCE_METHODS = new Set(["string", "number", "boolean", "bigint", "date"]);

type SchemaCall = { name: string; args: SchemaValue[] };
type SchemaExpr = { coerce: boolean; calls: SchemaCall[] };
type SchemaValue =
	| string
	| number
	| boolean
	| null
	| SchemaExpr
	| SchemaValue[]
	| { [key: string]: SchemaValue };

class SchemaParser {
	private pos = 0;
	constructor(private readonly text: string) {}

	parse(): SchemaExpr {
		const schema = this.schema();
		this.space();
		if (this.pos !== this.text.length) this.fail("unexpected token");
		return schema;
	}

	private schema(): SchemaExpr {
		this.expect("z.");
		let coerce = false;
		if (this.text.startsWith("coerce.", this.pos)) {
			this.pos += 7;
			coerce = true;
		}
		const calls = [this.call(coerce ? COERCE_METHODS : ALLOWED_ZOD_METHODS)];
		while (true) {
			this.space();
			if (this.text[this.pos] !== ".") break;
			this.pos++;
			calls.push(this.call(ALLOWED_ZOD_METHODS));
		}
		return { coerce, calls };
	}

	private call(allowed: Set<string>): SchemaCall {
		const name = this.identifier();
		if (!allowed.has(name)) this.fail(`unknown schema method "${name}"`);
		this.space();
		this.expect("(");
		const args: SchemaValue[] = [];
		this.space();
		while (this.text[this.pos] !== ")") {
			args.push(this.value());
			this.space();
			if (this.text[this.pos] !== ",") break;
			this.pos++;
			this.space();
		}
		this.expect(")");
		return { name, args };
	}

	private value(): SchemaValue {
		this.space();
		const c = this.text[this.pos];
		if (c === '"' || c === "'") return this.string(c);
		if (c === "[") return this.array();
		if (c === "{") return this.object();
		if (this.text.startsWith("z.", this.pos)) return this.schema();
		const literal = this.text
			.slice(this.pos)
			.match(/^(true|false|null|-?(?:\d+\.?\d*|\.\d+))/)?.[0];
		if (!literal) this.fail("expected a literal or schema");
		this.pos += literal.length;
		return literal === "true"
			? true
			: literal === "false"
				? false
				: literal === "null"
					? null
					: Number(literal);
	}

	private string(quote: string): string {
		this.pos++;
		let value = "";
		while (this.pos < this.text.length && this.text[this.pos] !== quote) {
			const c = this.text[this.pos++];
			if (c !== "\\") value += c;
			else {
				const escaped = this.text[this.pos++];
				const escapes: Record<string, string> = {
					n: "\n",
					r: "\r",
					t: "\t",
					b: "\b",
					f: "\f",
					v: "\v",
					"0": "\0",
				};
				value += escapes[escaped] ?? escaped;
			}
		}
		this.expect(quote);
		return value;
	}

	private array(): SchemaValue[] {
		this.pos++;
		const values: SchemaValue[] = [];
		this.space();
		while (this.text[this.pos] !== "]") {
			values.push(this.value());
			this.space();
			if (this.text[this.pos] !== ",") break;
			this.pos++;
			this.space();
		}
		this.expect("]");
		return values;
	}

	private object(): { [key: string]: SchemaValue } {
		this.pos++;
		const value: { [key: string]: SchemaValue } = Object.create(null);
		this.space();
		while (this.text[this.pos] !== "}") {
			const c = this.text[this.pos];
			const key = c === '"' || c === "'" ? this.string(c) : this.identifier();
			this.space();
			this.expect(":");
			value[key] = this.value();
			this.space();
			if (this.text[this.pos] !== ",") break;
			this.pos++;
			this.space();
		}
		this.expect("}");
		return value;
	}

	private identifier(): string {
		this.space();
		const value = this.text.slice(this.pos).match(/^[A-Za-z_$][\w$]*/)?.[0];
		if (!value) this.fail("expected identifier");
		this.pos += value.length;
		return value;
	}
	private space() {
		while (/\s/.test(this.text[this.pos] ?? "")) this.pos++;
	}
	private expect(value: string) {
		this.space();
		if (!this.text.startsWith(value, this.pos)) this.fail(`expected "${value}"`);
		this.pos += value.length;
	}
	private fail(message: string): never {
		throw new Error(`Invalid schema expression at ${this.pos}: ${message}`);
	}
}

function buildValue(value: SchemaValue): unknown {
	if (isSchema(value)) return buildSchema(value);
	if (Array.isArray(value)) return value.map(buildValue);
	if (value && typeof value === "object")
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, buildValue(v)]));
	return value;
}

function isSchema(value: SchemaValue): value is SchemaExpr {
	return !!value && typeof value === "object" && !Array.isArray(value) && "calls" in value;
}

function buildSchema(expr: SchemaExpr): z.ZodTypeAny {
	let target: any = expr.coerce ? z.coerce : z;
	for (const [index, { name, args }] of expr.calls.entries()) {
		target =
			expr.coerce && index === 0 && name === "boolean"
				? z.preprocess(
						(value) =>
							typeof value === "string" ? !["", "0", "false"].includes(value.toLowerCase()) : value,
						z.boolean(),
					)
				: target[name](...args.map(buildValue));
	}
	if (!(target instanceof z.ZodType))
		throw new Error("Schema expression did not produce a Zod schema");
	return target;
}

function renderValue(value: SchemaValue): string {
	if (isSchema(value)) return renderSchema(value);
	if (Array.isArray(value)) return `[${value.map(renderValue).join(", ")}]`;
	if (value && typeof value === "object")
		return `{ ${Object.entries(value)
			.map(([k, v]) => `${JSON.stringify(k)}: ${renderValue(v)}`)
			.join(", ")} }`;
	return JSON.stringify(value);
}

function renderSchema(expr: SchemaExpr): string {
	const [first, ...rest] = expr.calls;
	return `z.${expr.coerce ? "coerce." : ""}${first.name}(${first.args.map(renderValue).join(", ")})${rest.map((call) => `.${call.name}(${call.args.map(renderValue).join(", ")})`).join("")}`;
}

export function normalizeSchema(schemaText: string): string {
	const expr = new SchemaParser(schemaText).parse();
	buildSchema(expr);
	return renderSchema(expr);
}

export function evaluateSchema(schemaText: string): z.ZodType {
	const expr = new SchemaParser(schemaText).parse();
	return buildSchema(expr);
}

export interface ValidateResult {
	success: boolean;
	value?: unknown;
	issues?: Array<{ message: string }>;
}

export function validateValue(schemaText: string, value: unknown): ValidateResult {
	let coerced = value;
	if (typeof value === "string") {
		if (schemaText.includes("z.number()")) {
			const number = Number(value);
			if (!Number.isNaN(number)) coerced = number;
		} else if (schemaText.includes("z.boolean()")) coerced = value === "true" || value === "1";
	}
	const result = evaluateSchema(schemaText).safeParse(coerced);
	return result.success
		? { success: true, value: result.data }
		: { success: false, issues: result.error.issues.map((i) => ({ message: i.message })) };
}
