import { describe, expect, it } from "vitest";
import { SoqlLexer } from "../../src/parser/lexer.js";

describe("SoqlLexer", () => {
  it("tokenizes a basic SELECT", () => {
    const result = SoqlLexer.tokenize("SELECT Id, Name FROM Account WHERE Id = :id");
    expect(result.errors).toEqual([]);
    const types = result.tokens.map((t) => t.tokenType.name);
    expect(types).toEqual([
      "Select",
      "Identifier",
      "Comma",
      "Identifier",
      "From",
      "Identifier",
      "Where",
      "Identifier",
      "Eq",
      "BindParam",
    ]);
  });

  it("recognizes date literal tokens", () => {
    const result = SoqlLexer.tokenize("SELECT Id FROM Account WHERE CreatedDate > LAST_N_DAYS:30");
    expect(result.errors).toEqual([]);
    const tail = result.tokens[result.tokens.length - 1]!;
    expect(tail.tokenType.name).toBe("DateLiteralToken");
    expect(tail.image.toUpperCase()).toBe("LAST_N_DAYS:30");
  });

  it("distinguishes :param from date literals", () => {
    const result = SoqlLexer.tokenize("WHERE Id = :id");
    expect(result.errors).toEqual([]);
    expect(result.tokens.find((t) => t.tokenType.name === "BindParam")?.image).toBe(":id");
  });

  it("handles string literals with doubled quotes", () => {
    const result = SoqlLexer.tokenize("WHERE Name = 'O''Brien'");
    expect(result.errors).toEqual([]);
    const lit = result.tokens.find((t) => t.tokenType.name === "StringLiteral");
    expect(lit?.image).toBe("'O''Brien'");
  });
});
