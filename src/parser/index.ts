import { SoqlLexer } from "./lexer.js";
import { soqlParser } from "./grammar.js";
import { astBuilder } from "./cstToAst.js";
import type { SelectStmt } from "./ast.js";

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export interface ParseResult {
  ast?: SelectStmt;
  errors: ParseError[];
}

export function parseSoql(text: string): ParseResult {
  const lexResult = SoqlLexer.tokenize(text);
  const errors: ParseError[] = lexResult.errors.map((e) => ({
    message: e.message,
    line: e.line ?? 1,
    column: e.column ?? 1,
  }));
  if (errors.length > 0) return { errors };

  soqlParser.input = lexResult.tokens;
  const cst = soqlParser.selectStatement();
  for (const err of soqlParser.errors) {
    errors.push({
      message: err.message,
      line: err.token.startLine ?? 1,
      column: err.token.startColumn ?? 1,
    });
  }
  if (errors.length > 0) return { errors };

  const ast = astBuilder.visit(cst) as SelectStmt;
  return { ast, errors: [] };
}

export type { SelectStmt };
export * from "./ast.js";
export { parseQueryFile } from "./queryFileParser.js";
