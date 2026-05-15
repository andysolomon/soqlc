export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SelectStmt {
  kind: "select";
  columns: SelectItem[];
  from: string;
  where?: Expr;
  groupBy?: FieldPath[];
  having?: Expr;
  orderBy?: OrderByItem[];
  limit?: NumberOrParam;
  offset?: NumberOrParam;
  pos: Position;
}

export type SelectItem = FieldColumn | AggregateColumn | SubqueryColumn;

export interface FieldColumn {
  kind: "field";
  path: FieldPath;
  alias?: string;
}

export interface AggregateColumn {
  kind: "aggregate";
  fn: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  arg?: FieldPath; // undefined means COUNT()
  alias?: string;
}

export interface SubqueryColumn {
  kind: "subquery";
  query: SelectStmt;
  alias?: string;
}

export interface FieldPath {
  segments: string[]; // ["Account", "Name"] for "Account.Name"
  pos: Position;
}

export interface OrderByItem {
  path: FieldPath;
  direction?: "ASC" | "DESC";
  nulls?: "FIRST" | "LAST";
}

export type NumberOrParam =
  | { kind: "number"; value: number }
  | { kind: "param"; name: string };

export type PredicateLhs =
  | { kind: "fieldPath"; path: FieldPath }
  | { kind: "aggregate"; fn: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"; arg?: FieldPath };

export type Expr =
  | { kind: "and"; left: Expr; right: Expr }
  | { kind: "or"; left: Expr; right: Expr }
  | { kind: "not"; expr: Expr }
  | { kind: "compare"; left: PredicateLhs; op: CompareOp; right: Value }
  | { kind: "in"; left: PredicateLhs; not: boolean; values: Value[] | { param: string } }
  | { kind: "like"; left: PredicateLhs; not: boolean; pattern: Value };

export type CompareOp = "=" | "!=" | "<" | "<=" | ">" | ">=";

export type Value =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "null" }
  | { kind: "dateLiteral"; token: string }
  | { kind: "param"; name: string };

export interface NamedQuery {
  name: string;
  cardinality: "one" | "many";
  source: string;
  startLine: number;
  filePath: string;
}
