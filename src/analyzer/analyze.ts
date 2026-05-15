import type {
  AggregateColumn,
  Expr,
  FieldColumn,
  NumberOrParam,
  SelectStmt,
  SubqueryColumn,
  Value,
} from "../parser/ast.js";
import type { Schema, SObject } from "../schema/model.js";
import { getSObject } from "../schema/loader.js";
import { resolveFieldPath, resolveChildRelationship } from "./relationships.js";
import {
  applyNullability,
  DEFAULT_TYPE_MAP_OPTIONS,
  isOptionalProperty,
  soqlTypeToTs,
  type TypeMapOptions,
} from "./typeMap.js";
import type { Diagnostic } from "./errors.js";

export type TypeShape =
  | { kind: "scalar"; ts: string; optional: boolean }
  | { kind: "object"; fields: Record<string, TypeShape>; optional: boolean }
  | {
      kind: "subqueryRecord";
      recordType: TypeShape & { kind: "object" };
      optional: boolean;
    };

export interface AnalyzedArg {
  tsType: string;
  optional: boolean;
}

export interface AnalyzedQuery {
  name: string;
  cardinality: "one" | "many";
  source: string;
  filePath: string;
  startLine: number;
  args: Record<string, AnalyzedArg>;
  argOrder: string[];
  row: TypeShape & { kind: "object" };
}

interface AnalysisContext {
  schema: Schema;
  options: TypeMapOptions;
  diagnostics: Diagnostic[];
  filePath: string;
  queryName: string;
}

export interface AnalyzeOptions {
  typeMap?: Partial<TypeMapOptions>;
}

export function analyze(
  ast: SelectStmt,
  meta: { name: string; cardinality: "one" | "many"; filePath: string; startLine: number; source: string },
  schema: Schema,
  options: AnalyzeOptions = {},
): { query?: AnalyzedQuery; diagnostics: Diagnostic[] } {
  const typeMapOptions: TypeMapOptions = { ...DEFAULT_TYPE_MAP_OPTIONS, ...options.typeMap };
  const ctx: AnalysisContext = {
    schema,
    options: typeMapOptions,
    diagnostics: [],
    filePath: meta.filePath,
    queryName: meta.name,
  };

  const root = getSObject(schema, ast.from);
  if (!root) {
    diag(ctx, `Unknown sObject "${ast.from}"`, meta.startLine, 1);
    return { diagnostics: ctx.diagnostics };
  }

  const row: TypeShape & { kind: "object" } = { kind: "object", fields: {}, optional: false };
  let exprCounter = 0;

  for (const col of ast.columns) {
    analyzeColumn(ctx, root, col, row, () => `expr${exprCounter++}`);
  }

  const args: Record<string, AnalyzedArg> = {};
  const argOrder: string[] = [];
  if (ast.where) collectArgsFromExpr(ctx, root, ast.where, args, argOrder);
  if (ast.having) collectArgsFromExpr(ctx, root, ast.having, args, argOrder);
  collectArgFromLimitOffset(ast.limit, args, argOrder);
  collectArgFromLimitOffset(ast.offset, args, argOrder);

  if (ctx.diagnostics.length > 0) {
    return { diagnostics: ctx.diagnostics };
  }

  return {
    query: {
      name: meta.name,
      cardinality: meta.cardinality,
      source: meta.source,
      filePath: meta.filePath,
      startLine: meta.startLine,
      args,
      argOrder,
      row,
    },
    diagnostics: [],
  };
}

function analyzeColumn(
  ctx: AnalysisContext,
  root: SObject,
  col: FieldColumn | AggregateColumn | SubqueryColumn,
  row: TypeShape & { kind: "object" },
  nextExpr: () => string,
): void {
  switch (col.kind) {
    case "field":
      analyzeFieldColumn(ctx, root, col, row);
      return;
    case "aggregate": {
      const tsType = "number";
      const name = col.alias ?? nextExpr();
      row.fields[name] = { kind: "scalar", ts: tsType, optional: false };
      if (col.arg) {
        const res = resolveFieldPath(ctx.schema, root, col.arg);
        if (!res.ok) {
          diag(ctx, res.failure.reason, col.arg.pos.line, col.arg.pos.column);
        }
      }
      return;
    }
    case "subquery": {
      analyzeSubquery(ctx, root, col, row);
      return;
    }
  }
}

function analyzeFieldColumn(
  ctx: AnalysisContext,
  root: SObject,
  col: FieldColumn,
  row: TypeShape & { kind: "object" },
): void {
  const res = resolveFieldPath(ctx.schema, root, col.path);
  if (!res.ok) {
    diag(ctx, res.failure.reason, col.path.pos.line, col.path.pos.column);
    return;
  }
  const { field, parents } = res.resolved;
  const leafTs = soqlTypeToTs(field, ctx.options);
  const leafOptional = isOptionalProperty(field.nillable, ctx.options);
  const leafShape: TypeShape = {
    kind: "scalar",
    ts: applyNullability(leafTs, field.nillable, ctx.options),
    optional: leafOptional,
  };

  if (parents.length === 0) {
    const propName = col.alias ?? field.name;
    row.fields[propName] = leafShape;
    return;
  }

  let cursor: TypeShape & { kind: "object" } = row;
  for (let i = 0; i < parents.length; i++) {
    const parent = parents[i]!;
    const propName = parent.relationshipName;
    let next = cursor.fields[propName];
    if (!next || next.kind !== "object") {
      next = {
        kind: "object",
        fields: {},
        optional: isOptionalProperty(parent.nillable, ctx.options),
      };
      cursor.fields[propName] = next;
    }
    cursor = next as TypeShape & { kind: "object" };
  }
  const leafName = col.alias ?? field.name;
  cursor.fields[leafName] = leafShape;
}

function analyzeSubquery(
  ctx: AnalysisContext,
  root: SObject,
  col: SubqueryColumn,
  row: TypeShape & { kind: "object" },
): void {
  const inner = col.query;
  const childRel = resolveChildRelationship(root, inner.from);
  if (!childRel) {
    diag(
      ctx,
      `No child relationship "${inner.from}" on ${root.name}`,
      inner.pos.line,
      inner.pos.column,
    );
    return;
  }
  const child = getSObject(ctx.schema, childRel.childSObject);
  if (!child) {
    diag(
      ctx,
      `Child sObject "${childRel.childSObject}" not in schema`,
      inner.pos.line,
      inner.pos.column,
    );
    return;
  }
  // Recurse: build a sub-row using the child as the root.
  const subRow: TypeShape & { kind: "object" } = { kind: "object", fields: {}, optional: false };
  let exprCounter = 0;
  for (const sub of inner.columns) {
    if (sub.kind === "subquery") {
      diag(
        ctx,
        "Multi-level child subqueries are not supported in v0",
        sub.query.pos.line,
        sub.query.pos.column,
      );
      continue;
    }
    analyzeColumn(ctx, child, sub, subRow, () => `expr${exprCounter++}`);
  }
  row.fields[childRel.relationshipName] = {
    kind: "subqueryRecord",
    recordType: subRow,
    optional: true,
  };
}

function collectArgsFromExpr(
  ctx: AnalysisContext,
  root: SObject,
  expr: Expr,
  args: Record<string, AnalyzedArg>,
  argOrder: string[],
): void {
  switch (expr.kind) {
    case "and":
    case "or":
      collectArgsFromExpr(ctx, root, expr.left, args, argOrder);
      collectArgsFromExpr(ctx, root, expr.right, args, argOrder);
      return;
    case "not":
      collectArgsFromExpr(ctx, root, expr.expr, args, argOrder);
      return;
    case "compare":
      maybeAddArgFromLhs(ctx, root, expr.left, expr.right, args, argOrder);
      return;
    case "in": {
      const leafTs = lhsLeafTs(ctx, root, expr.left) ?? "string";
      if (Array.isArray(expr.values)) {
        for (const v of expr.values) {
          if (v.kind === "param") addArg(args, argOrder, v.name, leafTs, false);
        }
      } else {
        addArg(args, argOrder, expr.values.param, `${leafTs}[]`, false);
      }
      return;
    }
    case "like":
      maybeAddArgFromLhs(ctx, root, expr.left, expr.pattern, args, argOrder);
      return;
  }
}

function lhsLeafTs(
  ctx: AnalysisContext,
  root: SObject,
  lhs: { kind: "fieldPath"; path: { segments: string[] } } | { kind: "aggregate" },
): string | undefined {
  if (lhs.kind === "aggregate") return "number";
  return leafTsFromField(ctx, root, lhs.path.segments);
}

function maybeAddArgFromLhs(
  ctx: AnalysisContext,
  root: SObject,
  lhs: { kind: "fieldPath"; path: { segments: string[] } } | { kind: "aggregate" },
  v: Value,
  args: Record<string, AnalyzedArg>,
  argOrder: string[],
): void {
  if (v.kind !== "param") return;
  const tsType = lhsLeafTs(ctx, root, lhs) ?? "string | number | boolean";
  addArg(args, argOrder, v.name, tsType, false);
}

function leafTsFromField(
  ctx: AnalysisContext,
  root: SObject,
  segments: string[],
): string | undefined {
  const res = resolveFieldPath(ctx.schema, root, {
    segments,
    pos: { line: 1, column: 1, offset: 0 },
  });
  if (!res.ok) return undefined;
  return soqlTypeToTs(res.resolved.field, ctx.options);
}

function collectArgFromLimitOffset(
  clause: NumberOrParam | undefined,
  args: Record<string, AnalyzedArg>,
  argOrder: string[],
): void {
  if (!clause || clause.kind !== "param") return;
  addArg(args, argOrder, clause.name, "number", false);
}

function addArg(
  args: Record<string, AnalyzedArg>,
  argOrder: string[],
  name: string,
  tsType: string,
  optional: boolean,
): void {
  if (args[name]) return;
  args[name] = { tsType, optional };
  argOrder.push(name);
}

function diag(ctx: AnalysisContext, message: string, line: number, column: number): void {
  ctx.diagnostics.push({
    message,
    filePath: ctx.filePath,
    line,
    column,
    queryName: ctx.queryName,
  });
}
