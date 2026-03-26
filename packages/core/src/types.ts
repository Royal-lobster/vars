import type { ParseError } from "./errors.js";

// ── File-level constructs ────────────────────────

export interface ParseResult {
	ast: VarsFile;
	errors: ParseError[];
	warnings: ParseWarning[];
}

export interface ParseWarning {
	message: string;
	line: number;
}

export interface VarsFile {
	envs: string[];
	params: Param[];
	imports: Import[];
	declarations: Declaration[];
	checks: Check[];
}

export interface Param {
	name: string;
	values: string[];
	defaultValue: string;
	line: number;
}

export interface Import {
	path: string;
	filter?: ImportFilter;
	line: number;
}

export interface ImportFilter {
	kind: "pick" | "omit";
	names: string[];
}

// ── Declarations ─────────────────────────────────

export type Declaration = VariableDecl | GroupDecl;

export interface VariableDecl {
	kind: "variable";
	name: string;
	public: boolean;
	schema: string | null;
	value: Value | null;
	metadata: Metadata | null;
	line: number;
}

export interface GroupDecl {
	kind: "group";
	name: string;
	declarations: VariableDecl[];
	line: number;
}

// ── Values ───────────────────────────────────────

export type Value =
	| LiteralValue
	| EncryptedValue
	| InterpolatedValue
	| EnvBlockValue
	| ConditionalValue;

export interface LiteralValue {
	kind: "literal";
	value: string | number | boolean | unknown[] | Record<string, unknown>;
	line: number;
}

export interface EncryptedValue {
	kind: "encrypted";
	raw: string;
	line: number;
}

export interface InterpolatedValue {
	kind: "interpolated";
	template: string;
	refs: string[];
	line: number;
}

export interface EnvBlockValue {
	kind: "env_block";
	entries: EnvEntry[];
	line: number;
}

export interface ConditionalValue {
	kind: "conditional";
	whens: WhenClause[];
	fallback?: Value;
	line: number;
}

export interface EnvEntry {
	env: string;
	value: Value;
	when?: WhenCondition;
	line: number;
}

export interface WhenCondition {
	param: string;
	value: string;
}

export interface WhenClause {
	param: string;
	value: string;
	result: Value | EnvEntry[];
	line: number;
}

// ── Metadata ─────────────────────────────────────

export interface Metadata {
	description?: string;
	owner?: string;
	expires?: string;
	deprecated?: string;
	tags?: string[];
	see?: string;
}

// ── Checks ───────────────────────────────────────

export interface Check {
	description: string;
	predicates: CheckPredicate[];
	line: number;
}

export type CheckPredicate =
	| ComparisonPredicate
	| LogicalPredicate
	| NotPredicate
	| ImplicationPredicate
	| FunctionCallPredicate;

export interface ComparisonPredicate {
	kind: "comparison";
	left: CheckExpr;
	op: "==" | "!=" | ">" | "<" | ">=" | "<=";
	right: CheckExpr;
}

export interface LogicalPredicate {
	kind: "logical";
	op: "and" | "or";
	left: CheckPredicate;
	right: CheckPredicate;
}

export interface NotPredicate {
	kind: "not";
	operand: CheckPredicate;
}

export interface ImplicationPredicate {
	kind: "implication";
	antecedent: CheckPredicate;
	consequent: CheckPredicate;
}

export interface FunctionCallPredicate {
	kind: "function_call";
	name: "defined" | "matches" | "one_of" | "starts_with";
	args: CheckExpr[];
}

export type CheckExpr =
	| { kind: "var_ref"; name: string }
	| { kind: "string_literal"; value: string }
	| { kind: "number_literal"; value: number }
	| { kind: "boolean_literal"; value: boolean }
	| { kind: "array_literal"; values: CheckExpr[] }
	| { kind: "function_expr"; name: "length"; args: CheckExpr[] };

// ── Resolved types (post-resolution) ─────────────

export interface ResolvedVar {
	name: string;
	flatName: string;
	public: boolean;
	schema: string;
	value: string | undefined;
	metadata: Metadata | null;
	group?: string;
}

export interface ResolvedVars {
	vars: ResolvedVar[];
	checks: Check[];
	envs: string[];
	params: Param[];
	sourceFiles: string[];
}
