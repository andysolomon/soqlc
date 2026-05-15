import type { SoqlClient, SoqlQueryResult } from "../../../src/runtime/index.js";

/**
 * Minimal in-memory SoqlClient for smoke-testing generated code. Looks up
 * canned responses by checking whether the query starts with a known prefix.
 */
export function makeFakeClient(): SoqlClient {
  return {
    async query<T>(soql: string): Promise<SoqlQueryResult<T>> {
      if (soql.startsWith("SELECT Id, Name, Industry, AnnualRevenue FROM Account WHERE Id =")) {
        return ok([
          { Id: "001AAA", Name: "Acme Corp", Industry: "Tech", AnnualRevenue: 1_000_000 },
        ] as T[]);
      }
      if (soql.startsWith("SELECT Id, Name, AnnualRevenue FROM Account WHERE Industry =")) {
        return ok([
          { Id: "001AAA", Name: "Acme Corp", AnnualRevenue: 1_000_000 },
          { Id: "001BBB", Name: "Beta LLC", AnnualRevenue: 250_000 },
        ] as T[]);
      }
      if (soql.startsWith("SELECT Id, Name, (SELECT Id, FirstName, LastName, Email FROM Contacts) FROM Account")) {
        return ok([
          {
            Id: "001AAA",
            Name: "Acme Corp",
            Contacts: {
              totalSize: 1,
              done: true,
              records: [{ Id: "003AAA", FirstName: "Ada", LastName: "Lovelace", Email: null }],
            },
          },
        ] as T[]);
      }
      return ok([] as T[]);
    },
  };
}

function ok<T>(records: T[]): SoqlQueryResult<T> {
  return { totalSize: records.length, done: true, records };
}
