import { describe, expect, it } from "vitest";
import { parseSoql } from "../../src/parser/index.js";

describe("parseSoql", () => {
  it("parses a basic SELECT", () => {
    const result = parseSoql("SELECT Id, Name FROM Account WHERE Id = :id");
    expect(result.errors).toEqual([]);
    expect(result.ast?.from).toBe("Account");
    expect(result.ast?.columns).toHaveLength(2);
    expect(result.ast?.where?.kind).toBe("compare");
  });

  it("parses aggregates with aliases", () => {
    const result = parseSoql("SELECT Industry, COUNT(Id) total FROM Account GROUP BY Industry");
    expect(result.errors).toEqual([]);
    expect(result.ast?.columns[1]).toEqual(
      expect.objectContaining({ kind: "aggregate", fn: "COUNT", alias: "total" }),
    );
    expect(result.ast?.groupBy).toHaveLength(1);
  });

  it("parses a child subquery", () => {
    const result = parseSoql("SELECT Id, (SELECT Id FROM Contacts) FROM Account");
    expect(result.errors).toEqual([]);
    expect(result.ast?.columns[1]?.kind).toBe("subquery");
  });

  it("parses ORDER BY ... LIMIT :p", () => {
    const result = parseSoql("SELECT Id FROM Account ORDER BY Name DESC LIMIT :max");
    expect(result.errors).toEqual([]);
    expect(result.ast?.orderBy?.[0]?.direction).toBe("DESC");
    expect(result.ast?.limit).toEqual({ kind: "param", name: "max" });
  });

  it("reports an error on garbage", () => {
    const result = parseSoql("NOT VALID SOQL");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("parses IN with a list", () => {
    const result = parseSoql("SELECT Id FROM Account WHERE Industry IN ('Tech', 'Finance')");
    expect(result.errors).toEqual([]);
    const where = result.ast?.where;
    expect(where?.kind).toBe("in");
  });

  it("parses NOT IN with a bind param", () => {
    const result = parseSoql("SELECT Id FROM Account WHERE Industry NOT IN (:industries)");
    expect(result.errors).toEqual([]);
    const where = result.ast?.where;
    expect(where?.kind).toBe("in");
    if (where?.kind === "in") {
      expect(where.not).toBe(true);
      expect(where.values).toEqual({ param: "industries" });
    }
  });
});
