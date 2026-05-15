import type { AnalyzedQuery } from "../../analyzer/analyze.js";
import { camelCase, indent, renderTypeShape } from "./templates.js";
import { emitBindCall, hasParams } from "./emitParamBinding.js";

export function emitQuery(q: AnalyzedQuery): string {
  const constName = `${q.name}Query`;
  const argsName = `${q.name}Args`;
  const rowName = `${q.name}Row`;
  const fnName = camelCase(q.name);

  const literal = renderSoqlLiteral(q.source);
  const argsIface = emitArgsInterface(argsName, q);
  const rowIface = `export interface ${rowName} ${renderTypeShape(q.row)}`;
  const fn = emitFunction(fnName, argsName, rowName, constName, q);

  const parts = [
    `export const ${constName} = ${literal};`,
    "",
    argsIface,
    "",
    rowIface,
    "",
    fn,
  ];
  return parts.join("\n") + "\n";
}

function emitArgsInterface(argsName: string, q: AnalyzedQuery): string {
  if (!hasParams(q)) {
    return `export type ${argsName} = Record<string, never>;`;
  }
  const lines = q.argOrder.map((name) => {
    const arg = q.args[name]!;
    const sep = arg.optional ? "?:" : ":";
    return `  ${name}${sep} ${arg.tsType};`;
  });
  return `export interface ${argsName} {\n${lines.join("\n")}\n}`;
}

function emitFunction(
  fnName: string,
  argsName: string,
  rowName: string,
  constName: string,
  q: AnalyzedQuery,
): string {
  const argsParam = hasParams(q) ? `args: ${argsName}` : `_args?: ${argsName}`;
  const returnType =
    q.cardinality === "one" ? `Promise<${rowName} | null>` : `Promise<${rowName}[]>`;
  const bindLine = emitBindCall(constName, q);
  const queryCall = `const result = await client.query<${rowName}>(soql);`;
  const returnLine =
    q.cardinality === "one" ? "return result.records[0] ?? null;" : "return result.records;";
  const body = [bindLine, queryCall, returnLine].join("\n");
  return [
    `export async function ${fnName}(`,
    `  client: SoqlClient,`,
    `  ${argsParam},`,
    `): ${returnType} {`,
    indent(body, 2),
    `}`,
  ].join("\n");
}

function renderSoqlLiteral(source: string): string {
  // Use a backtick template literal. Backticks and ${ in SOQL are extremely
  // unusual, but we escape them just in case.
  const escaped = source.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  // Compact whitespace into single spaces for the emitted constant.
  const flat = escaped.replace(/\s+/g, " ").trim();
  return `\`${flat}\``;
}
