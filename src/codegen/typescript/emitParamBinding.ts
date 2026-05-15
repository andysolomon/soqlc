import type { AnalyzedQuery } from "../../analyzer/analyze.js";

export function hasParams(q: AnalyzedQuery): boolean {
  return q.argOrder.length > 0;
}

export function emitBindCall(constName: string, q: AnalyzedQuery): string {
  if (!hasParams(q)) return `const soql = ${constName};`;
  return `const soql = bindParams(${constName}, args);`;
}
