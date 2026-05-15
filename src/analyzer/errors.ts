import type { Position } from "../parser/ast.js";

export interface Diagnostic {
  message: string;
  filePath: string;
  line: number;
  column: number;
  queryName?: string;
}

export function makeDiagnostic(
  message: string,
  filePath: string,
  pos: Position | { line: number; column: number },
  queryName?: string,
): Diagnostic {
  return {
    message,
    filePath,
    line: pos.line,
    column: pos.column,
    queryName,
  };
}

export function formatDiagnostic(d: Diagnostic): string {
  const prefix = d.queryName ? `${d.filePath}:${d.line}:${d.column} [${d.queryName}]` : `${d.filePath}:${d.line}:${d.column}`;
  return `${prefix} ${d.message}`;
}
