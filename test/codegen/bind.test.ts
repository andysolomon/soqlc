import { describe, expect, it } from "vitest";
import { bindParams, renderSoqlValue } from "../../src/runtime/bind.js";

describe("bindParams", () => {
  it("substitutes a string with proper escaping", () => {
    const out = bindParams("WHERE Name = :name", { name: "O'Brien" });
    expect(out).toBe("WHERE Name = 'O\\'Brien'");
  });

  it("substitutes numbers and booleans", () => {
    expect(bindParams("LIMIT :n", { n: 10 })).toBe("LIMIT 10");
    expect(bindParams("WHERE Active = :a", { a: true })).toBe("WHERE Active = true");
  });

  it("renders null/undefined as null", () => {
    expect(bindParams("WHERE F = :x", { x: null })).toBe("WHERE F = null");
    expect(bindParams("WHERE F = :x", { x: undefined })).toBe("WHERE F = null");
  });

  it("renders arrays as SOQL list", () => {
    expect(bindParams("WHERE F IN :xs", { xs: ["a", "b", "c"] })).toBe(
      "WHERE F IN ('a', 'b', 'c')",
    );
  });

  it("renders Date as ISO 8601", () => {
    const d = new Date("2026-05-15T10:00:00.000Z");
    expect(bindParams("WHERE CreatedDate > :d", { d })).toBe(
      "WHERE CreatedDate > 2026-05-15T10:00:00.000Z",
    );
  });

  it("throws on missing argument", () => {
    expect(() => bindParams("WHERE F = :missing", {})).toThrow(/missing argument ":missing"/);
  });

  it("substitutes every occurrence", () => {
    expect(bindParams("WHERE A = :x OR B = :x", { x: 1 })).toBe("WHERE A = 1 OR B = 1");
  });

  it("renderSoqlValue handles bigint", () => {
    expect(renderSoqlValue(123n)).toBe("123");
  });
});
