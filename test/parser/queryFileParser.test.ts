import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseQueryFile } from "../../src/parser/queryFileParser.js";

describe("parseQueryFile", () => {
  it("splits a multi-query file", () => {
    const text = readFileSync(
      resolve(__dirname, "../fixtures/queries/accounts.soql"),
      "utf8",
    );
    const result = parseQueryFile(text, "accounts.soql");
    expect(result.errors).toEqual([]);
    expect(result.queries.map((q) => q.name)).toEqual([
      "GetAccountById",
      "ListAccountsByIndustry",
      "GetAccountWithContacts",
      "CountByIndustry",
    ]);
    expect(result.queries[0]?.cardinality).toBe("one");
    expect(result.queries[1]?.cardinality).toBe("many");
  });

  it("flags duplicate names", () => {
    const text = `-- name: Dup :one
SELECT Id FROM A;

-- name: Dup :one
SELECT Id FROM B;
`;
    const result = parseQueryFile(text, "dup.soql");
    expect(result.errors.some((e) => /Duplicate/.test(e.message))).toBe(true);
  });

  it("ignores comments before first header", () => {
    const text = `-- some leading note
-- name: X :one
SELECT Id FROM A;
`;
    const result = parseQueryFile(text, "x.soql");
    expect(result.errors).toEqual([]);
    expect(result.queries).toHaveLength(1);
  });

  it("accepts // headers and // line comments (SF DX style)", () => {
    const text = `// leading note
// name: GetA :one
SELECT Id FROM A WHERE Id = :id;
`;
    const result = parseQueryFile(text, "x.soql");
    expect(result.errors).toEqual([]);
    expect(result.queries).toHaveLength(1);
    expect(result.queries[0]?.name).toBe("GetA");
  });
});
