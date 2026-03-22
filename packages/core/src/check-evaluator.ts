import type { CheckPredicate, CheckExpr } from "./types.js";

export function evaluateCheck(
  predicate: CheckPredicate,
  vars: Record<string, string | undefined>,
  env: string,
  params: Record<string, string> = {},
): boolean {
  return evalPredicate(predicate, vars, env, params);
}

function evalPredicate(
  pred: CheckPredicate,
  vars: Record<string, string | undefined>,
  env: string,
  params: Record<string, string>,
): boolean {
  switch (pred.kind) {
    case "comparison": {
      const left = evalExpr(pred.left, vars, env, params);
      const right = evalExpr(pred.right, vars, env, params);
      return compare(left, right, pred.op);
    }
    case "logical":
      if (pred.op === "and") {
        return (
          evalPredicate(pred.left, vars, env, params) &&
          evalPredicate(pred.right, vars, env, params)
        );
      }
      return (
        evalPredicate(pred.left, vars, env, params) ||
        evalPredicate(pred.right, vars, env, params)
      );
    case "not":
      return !evalPredicate(pred.operand, vars, env, params);
    case "implication":
      return (
        !evalPredicate(pred.antecedent, vars, env, params) ||
        evalPredicate(pred.consequent, vars, env, params)
      );
    case "function_call":
      return evalFunctionCall(pred.name, pred.args, vars, env, params);
  }
}

function evalExpr(
  expr: CheckExpr,
  vars: Record<string, string | undefined>,
  env: string,
  params: Record<string, string>,
): string | number | boolean | unknown[] | undefined {
  switch (expr.kind) {
    case "var_ref": {
      if (expr.name === "env") return env;
      if (expr.name in params) return params[expr.name];
      return vars[expr.name];
    }
    case "string_literal":
      return expr.value;
    case "number_literal":
      return expr.value;
    case "boolean_literal":
      return expr.value;
    case "array_literal":
      return expr.values.map((v) => evalExpr(v, vars, env, params));
    case "function_expr": {
      if (expr.name === "length") {
        const val = evalExpr(expr.args[0]!, vars, env, params);
        if (typeof val === "string") return val.length;
        if (Array.isArray(val)) return val.length;
        return 0;
      }
      return 0;
    }
  }
}

function compare(
  left: string | number | boolean | unknown[] | undefined,
  right: string | number | boolean | unknown[] | undefined,
  op: string,
): boolean {
  // Coerce for numeric comparisons
  const numLeft = Number(left);
  const numRight = Number(right);
  const useNum =
    !isNaN(numLeft) && !isNaN(numRight) && op !== "==" && op !== "!=";

  switch (op) {
    case "==":
      return String(left) === String(right);
    case "!=":
      return String(left) !== String(right);
    case ">":
      return useNum ? numLeft > numRight : String(left) > String(right);
    case "<":
      return useNum ? numLeft < numRight : String(left) < String(right);
    case ">=":
      return useNum ? numLeft >= numRight : String(left) >= String(right);
    case "<=":
      return useNum ? numLeft <= numRight : String(left) <= String(right);
    default:
      return false;
  }
}

function evalFunctionCall(
  name: string,
  args: CheckExpr[],
  vars: Record<string, string | undefined>,
  env: string,
  params: Record<string, string>,
): boolean {
  switch (name) {
    case "defined": {
      const varName = args[0]!.kind === "var_ref" ? (args[0] as { kind: "var_ref"; name: string }).name : "";
      const val = vars[varName];
      return val !== undefined && val !== "";
    }
    case "starts_with": {
      const val = String(evalExpr(args[0]!, vars, env, params) ?? "");
      const prefix = String(evalExpr(args[1]!, vars, env, params) ?? "");
      return val.startsWith(prefix);
    }
    case "matches": {
      const val = String(evalExpr(args[0]!, vars, env, params) ?? "");
      const pattern = String(evalExpr(args[1]!, vars, env, params) ?? "");
      return new RegExp(pattern).test(val);
    }
    case "one_of": {
      const val = String(evalExpr(args[0]!, vars, env, params) ?? "");
      const arr = evalExpr(args[1]!, vars, env, params);
      if (Array.isArray(arr)) return arr.some((item) => String(item) === val);
      return false;
    }
    default:
      return false;
  }
}
