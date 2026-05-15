import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSchemaFromString, getSObject } from "../../src/schema/loader.js";

const text = readFileSync(resolve(__dirname, "../fixtures/schema.soql.json"), "utf8");

describe("loadSchema", () => {
  it("loads sObjects and injects system fields", () => {
    const schema = loadSchemaFromString(text);
    const account = getSObject(schema, "Account");
    expect(account).toBeDefined();
    const names = account!.fields.map((f) => f.name);
    expect(names).toContain("CreatedDate");
    expect(names).toContain("LastModifiedDate");
    expect(names).toContain("SystemModstamp");
    expect(names).toContain("IsDeleted");
  });

  it("does not double-inject Id when declared", () => {
    const schema = loadSchemaFromString(text);
    const account = getSObject(schema, "Account")!;
    const ids = account.fields.filter((f) => f.name === "Id");
    expect(ids).toHaveLength(1);
  });

  it("rejects invalid types", () => {
    const bad = JSON.stringify({
      version: "1",
      sObjects: [
        { name: "X", fields: [{ name: "F", type: "NotARealType", nillable: true }] },
      ],
    });
    expect(() => loadSchemaFromString(bad)).toThrow();
  });
});
