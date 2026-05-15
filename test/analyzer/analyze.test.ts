import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSchemaFromString } from "../../src/schema/loader.js";
import { parseSoql } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/analyze.js";

const schema = loadSchemaFromString(
  readFileSync(resolve(__dirname, "../fixtures/schema.soql.json"), "utf8"),
);

function analyzeSoql(name: string, cardinality: "one" | "many", source: string) {
  const parse = parseSoql(source);
  if (parse.errors.length > 0) {
    throw new Error("parse failed: " + parse.errors.map((e) => e.message).join("; "));
  }
  return analyze(
    parse.ast!,
    { name, cardinality, filePath: "<test>", startLine: 1, source },
    schema,
  );
}

describe("analyze", () => {
  it("resolves scalar fields and bind params", () => {
    const { query, diagnostics } = analyzeSoql(
      "GetAccountById",
      "one",
      "SELECT Id, Name, Industry, AnnualRevenue FROM Account WHERE Id = :id",
    );
    expect(diagnostics).toEqual([]);
    expect(query!.args).toEqual({ id: { tsType: "string", optional: false } });
    expect(query!.row.fields.Id).toEqual({ kind: "scalar", ts: "string", optional: false });
    expect(query!.row.fields.AnnualRevenue).toEqual({
      kind: "scalar",
      ts: "number | undefined",
      optional: true,
    });
    expect((query!.row.fields.Industry as { ts: string }).ts).toContain('"Tech"');
  });

  it("emits picklist literal union", () => {
    const { query } = analyzeSoql(
      "Q",
      "many",
      "SELECT Industry FROM Account WHERE Industry = :industry",
    );
    const ts = (query!.row.fields.Industry as { ts: string }).ts;
    expect(ts).toBe('"Tech" | "Finance" | "Healthcare" | undefined');
    expect(query!.args.industry?.tsType).toContain('"Tech"');
  });

  it("rejects unknown sObject", () => {
    const { diagnostics } = analyzeSoql("Q", "one", "SELECT Id FROM NoSuchObj");
    expect(diagnostics[0]?.message).toMatch(/Unknown sObject/);
  });

  it("rejects unknown field", () => {
    const { diagnostics } = analyzeSoql("Q", "one", "SELECT Bogus FROM Account");
    expect(diagnostics[0]?.message).toMatch(/Unknown field "Bogus"/);
  });

  it("resolves parent dot-walk", () => {
    const { query, diagnostics } = analyzeSoql(
      "Q",
      "many",
      "SELECT Id, Account.Name FROM Contact",
    );
    expect(diagnostics).toEqual([]);
    const account = query!.row.fields.Account as { fields: Record<string, { ts: string }> };
    expect(account.fields.Name?.ts).toBe("string");
  });

  it("resolves child subquery", () => {
    const { query, diagnostics } = analyzeSoql(
      "Q",
      "one",
      "SELECT Id, (SELECT Id, FirstName FROM Contacts) FROM Account WHERE Id = :id",
    );
    expect(diagnostics).toEqual([]);
    expect(query!.row.fields.Contacts?.kind).toBe("subqueryRecord");
  });

  it("aggregates produce number with alias", () => {
    const { query } = analyzeSoql(
      "Q",
      "many",
      "SELECT Industry, COUNT(Id) total FROM Account GROUP BY Industry",
    );
    expect(query!.row.fields.total).toEqual({ kind: "scalar", ts: "number", optional: false });
  });

  it("infers IN bind param as array", () => {
    const { query } = analyzeSoql(
      "Q",
      "many",
      "SELECT Id FROM Account WHERE Industry IN (:ids)",
    );
    expect(query!.args.ids?.tsType).toMatch(/\[\]/);
  });

  it("infers LIMIT :p as number", () => {
    const { query } = analyzeSoql("Q", "many", "SELECT Id FROM Account LIMIT :max");
    expect(query!.args.max?.tsType).toBe("number");
  });
});
