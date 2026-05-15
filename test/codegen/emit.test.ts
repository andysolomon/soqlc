import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSchemaFromString } from "../../src/schema/loader.js";
import { parseSoql } from "../../src/parser/index.js";
import { parseQueryFile } from "../../src/parser/queryFileParser.js";
import { analyze, type AnalyzedQuery } from "../../src/analyzer/analyze.js";
import { emitFile } from "../../src/codegen/index.js";

const schemaText = readFileSync(resolve(__dirname, "../fixtures/schema.soql.json"), "utf8");
const queryText = readFileSync(resolve(__dirname, "../fixtures/queries/accounts.soql"), "utf8");
const schema = loadSchemaFromString(schemaText);

function buildAnalyzed(): AnalyzedQuery[] {
  const file = parseQueryFile(queryText, "accounts.soql");
  expect(file.errors).toEqual([]);
  const analyzed: AnalyzedQuery[] = [];
  for (const q of file.queries) {
    const parse = parseSoql(q.source);
    expect(parse.errors).toEqual([]);
    const result = analyze(
      parse.ast!,
      {
        name: q.name,
        cardinality: q.cardinality,
        filePath: q.filePath,
        startLine: q.startLine,
        source: q.source,
      },
      schema,
    );
    expect(result.diagnostics).toEqual([]);
    if (result.query) analyzed.push(result.query);
  }
  return analyzed;
}

describe("emitFile", () => {
  it("emits a stable TypeScript module", () => {
    const code = emitFile(buildAnalyzed(), { runtimeImportSpecifier: "soqlc/runtime" });
    expect(code).toMatchSnapshot();
  });

  it("contains the expected exports", () => {
    const code = emitFile(buildAnalyzed(), { runtimeImportSpecifier: "soqlc/runtime" });
    expect(code).toContain("export const GetAccountByIdQuery");
    expect(code).toContain("export interface GetAccountByIdArgs");
    expect(code).toContain("export interface GetAccountByIdRow");
    expect(code).toContain("export async function getAccountById(");
    expect(code).toContain("Promise<GetAccountByIdRow | null>");
    expect(code).toContain("Promise<ListAccountsByIndustryRow[]>");
  });
});
