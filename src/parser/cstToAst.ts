import type { CstNode, IToken } from "chevrotain";
import { BaseVisitor } from "./grammar.js";
import type {
  AggregateColumn,
  CompareOp,
  Expr,
  FieldColumn,
  FieldPath,
  NumberOrParam,
  OrderByItem,
  Position,
  PredicateLhs,
  SelectItem,
  SelectStmt,
  SubqueryColumn,
  Value,
} from "./ast.js";

function tokenPos(token: IToken): Position {
  return {
    line: token.startLine ?? 1,
    column: token.startColumn ?? 1,
    offset: token.startOffset,
  };
}

function unwrapString(image: string): string {
  const inner = image.slice(1, -1);
  return inner.replace(/''/g, "'").replace(/\\(.)/g, (_, c) => c);
}

type Ctx = Record<string, unknown>;

function firstNode(ctx: Ctx, key: string): CstNode {
  const arr = ctx[key] as CstNode[] | undefined;
  if (!arr || arr.length === 0) throw new Error(`Missing CST node "${key}"`);
  return arr[0]!;
}

function maybeFirstNode(ctx: Ctx, key: string): CstNode | undefined {
  const arr = ctx[key] as CstNode[] | undefined;
  return arr && arr.length > 0 ? arr[0]! : undefined;
}

function nodes(ctx: Ctx, key: string): CstNode[] {
  return (ctx[key] as CstNode[] | undefined) ?? [];
}

function firstToken(ctx: Ctx, key: string): IToken {
  const arr = ctx[key] as IToken[] | undefined;
  if (!arr || arr.length === 0) throw new Error(`Missing token "${key}"`);
  return arr[0]!;
}

function tokens(ctx: Ctx, key: string): IToken[] {
  return (ctx[key] as IToken[] | undefined) ?? [];
}

class AstBuilder extends BaseVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  selectStatement(ctx: Ctx): SelectStmt {
    const selectTok = firstToken(ctx, "Select");
    const fromTable = firstToken(ctx, "Identifier").image;
    const columns: SelectItem[] = this.visit(firstNode(ctx, "selectList"));
    const whereNode = maybeFirstNode(ctx, "whereClause");
    const groupByNode = maybeFirstNode(ctx, "groupByClause");
    const havingNode = maybeFirstNode(ctx, "havingClause");
    const orderByNode = maybeFirstNode(ctx, "orderByClause");
    const limitNode = maybeFirstNode(ctx, "limitClause");
    const offsetNode = maybeFirstNode(ctx, "offsetClause");
    return {
      kind: "select",
      columns,
      from: fromTable,
      where: whereNode ? this.visit(whereNode) : undefined,
      groupBy: groupByNode ? this.visit(groupByNode) : undefined,
      having: havingNode ? this.visit(havingNode) : undefined,
      orderBy: orderByNode ? this.visit(orderByNode) : undefined,
      limit: limitNode ? this.visit(limitNode) : undefined,
      offset: offsetNode ? this.visit(offsetNode) : undefined,
      pos: tokenPos(selectTok),
    };
  }

  selectList(ctx: Ctx): SelectItem[] {
    return nodes(ctx, "selectItem").map((node) => this.visit(node) as SelectItem);
  }

  selectItem(ctx: Ctx): SelectItem {
    let item: SelectItem;
    const sub = maybeFirstNode(ctx, "subqueryItem");
    if (sub) {
      item = this.visit(sub) as SubqueryColumn;
    } else {
      item = this.visit(firstNode(ctx, "aggregateOrField"));
    }
    const aliasTokens = tokens(ctx, "alias");
    if (aliasTokens.length > 0) {
      item.alias = aliasTokens[0]!.image;
    }
    return item;
  }

  subqueryItem(ctx: Ctx): SubqueryColumn {
    const query: SelectStmt = this.visit(firstNode(ctx, "selectStatement"));
    return { kind: "subquery", query };
  }

  aggregateOrField(ctx: Ctx): SelectItem {
    const agg = maybeFirstNode(ctx, "aggregateCall");
    if (agg) return this.visit(agg) as AggregateColumn;
    const path: FieldPath = this.visit(firstNode(ctx, "fieldPath"));
    return { kind: "field", path } as FieldColumn;
  }

  aggregateCall(ctx: Ctx): AggregateColumn {
    const fnName = firstToken(ctx, "fn").image.toUpperCase();
    const argNode = maybeFirstNode(ctx, "fieldPath");
    const arg = argNode ? (this.visit(argNode) as FieldPath) : undefined;
    return {
      kind: "aggregate",
      fn: fnName as AggregateColumn["fn"],
      arg,
    };
  }

  fieldPath(ctx: Ctx): FieldPath {
    const ids = tokens(ctx, "Identifier");
    return {
      segments: ids.map((t) => t.image),
      pos: tokenPos(ids[0]!),
    };
  }

  whereClause(ctx: Ctx): Expr {
    return this.visit(firstNode(ctx, "expression"));
  }

  expression(ctx: Ctx): Expr {
    const parts = nodes(ctx, "andExpr");
    let acc: Expr = this.visit(parts[0]!);
    for (let i = 1; i < parts.length; i++) {
      acc = { kind: "or", left: acc, right: this.visit(parts[i]!) };
    }
    return acc;
  }

  andExpr(ctx: Ctx): Expr {
    const parts = nodes(ctx, "notExpr");
    let acc: Expr = this.visit(parts[0]!);
    for (let i = 1; i < parts.length; i++) {
      acc = { kind: "and", left: acc, right: this.visit(parts[i]!) };
    }
    return acc;
  }

  notExpr(ctx: Ctx): Expr {
    const inner: Expr = this.visit(firstNode(ctx, "primaryExpr"));
    if (ctx.Not) return { kind: "not", expr: inner };
    return inner;
  }

  primaryExpr(ctx: Ctx): Expr {
    const exprNode = maybeFirstNode(ctx, "expression");
    if (exprNode) return this.visit(exprNode);
    return this.visit(firstNode(ctx, "predicate"));
  }

  predicate(ctx: Ctx): Expr {
    const left: PredicateLhs = this.visit(firstNode(ctx, "predicateLhs"));
    const cmpNode = maybeFirstNode(ctx, "comparePart");
    if (cmpNode) {
      const { op, value } = this.visit(cmpNode) as { op: CompareOp; value: Value };
      return { kind: "compare", left, op, right: value };
    }
    const inNode = maybeFirstNode(ctx, "inPart");
    if (inNode) {
      const { not, values } = this.visit(inNode) as {
        not: boolean;
        values: Value[] | { param: string };
      };
      return { kind: "in", left, not, values };
    }
    const likeNode = firstNode(ctx, "likePart");
    const { not, pattern } = this.visit(likeNode) as { not: boolean; pattern: Value };
    return { kind: "like", left, not, pattern };
  }

  predicateLhs(ctx: Ctx): PredicateLhs {
    const agg = maybeFirstNode(ctx, "aggregateCall");
    if (agg) {
      const ac = this.visit(agg) as AggregateColumn;
      return { kind: "aggregate", fn: ac.fn, arg: ac.arg };
    }
    const path: FieldPath = this.visit(firstNode(ctx, "fieldPath"));
    return { kind: "fieldPath", path };
  }

  comparePart(ctx: Ctx): { op: CompareOp; value: Value } {
    let op: CompareOp = "=";
    if (ctx.Eq) op = "=";
    else if (ctx.NotEq) op = "!=";
    else if (ctx.Lte) op = "<=";
    else if (ctx.Gte) op = ">=";
    else if (ctx.Lt) op = "<";
    else if (ctx.Gt) op = ">";
    const value: Value = this.visit(firstNode(ctx, "value"));
    return { op, value };
  }

  inPart(ctx: Ctx): { not: boolean; values: Value[] | { param: string } } {
    const not = !!ctx.Not;
    const bindTokens = tokens(ctx, "BindParam");
    if (bindTokens.length > 0) {
      return { not, values: { param: bindTokens[0]!.image.slice(1) } };
    }
    const valueNodes = nodes(ctx, "value");
    return { not, values: valueNodes.map((n) => this.visit(n) as Value) };
  }

  likePart(ctx: Ctx): { not: boolean; pattern: Value } {
    const not = !!ctx.Not;
    const pattern: Value = this.visit(firstNode(ctx, "value"));
    return { not, pattern };
  }

  value(ctx: Ctx): Value {
    const strTokens = tokens(ctx, "StringLiteral");
    if (strTokens.length > 0) return { kind: "string", value: unwrapString(strTokens[0]!.image) };
    const numTokens = tokens(ctx, "NumberLiteral");
    if (numTokens.length > 0) return { kind: "number", value: Number(numTokens[0]!.image) };
    if (ctx.True) return { kind: "bool", value: true };
    if (ctx.False) return { kind: "bool", value: false };
    if (ctx.Null) return { kind: "null" };
    const dateTokens = tokens(ctx, "DateLiteralToken");
    if (dateTokens.length > 0) return { kind: "dateLiteral", token: dateTokens[0]!.image };
    const bindTokens = tokens(ctx, "BindParam");
    return { kind: "param", name: bindTokens[0]!.image.slice(1) };
  }

  groupByClause(ctx: Ctx): FieldPath[] {
    return nodes(ctx, "fieldPath").map((n) => this.visit(n) as FieldPath);
  }

  havingClause(ctx: Ctx): Expr {
    return this.visit(firstNode(ctx, "expression"));
  }

  orderByClause(ctx: Ctx): OrderByItem[] {
    return nodes(ctx, "orderByItem").map((n) => this.visit(n) as OrderByItem);
  }

  orderByItem(ctx: Ctx): OrderByItem {
    const path: FieldPath = this.visit(firstNode(ctx, "fieldPath"));
    const direction = ctx.Asc ? "ASC" : ctx.Desc ? "DESC" : undefined;
    const nulls = ctx.First ? "FIRST" : ctx.Last ? "LAST" : undefined;
    return { path, direction, nulls };
  }

  limitClause(ctx: Ctx): NumberOrParam {
    const numTokens = tokens(ctx, "NumberLiteral");
    if (numTokens.length > 0) return { kind: "number", value: Number(numTokens[0]!.image) };
    const bindTokens = tokens(ctx, "BindParam");
    return { kind: "param", name: bindTokens[0]!.image.slice(1) };
  }

  offsetClause(ctx: Ctx): NumberOrParam {
    const numTokens = tokens(ctx, "NumberLiteral");
    if (numTokens.length > 0) return { kind: "number", value: Number(numTokens[0]!.image) };
    const bindTokens = tokens(ctx, "BindParam");
    return { kind: "param", name: bindTokens[0]!.image.slice(1) };
  }
}

export const astBuilder = new AstBuilder();
