# Roadmap

## v0 (current)

- TypeScript codegen only.
- Local `schema.soql.json` schema source.
- Driver-agnostic `SoqlClient` interface.
- SOQL subset: SELECT, WHERE, ORDER BY, LIMIT, OFFSET, GROUP BY, HAVING,
  aggregates, one-level child subquery, child-to-parent dot notation, date
  literal tokens, `:param` bind variables.
- `soqlc generate`, `soqlc compile`, `soqlc init`.
- vitest unit + snapshot tests.

## Near-term

- **`soqlc pull-schema`** — fetch sObject metadata from a connected Salesforce
  org and write `schema.soql.json`. Target org for initial testing:
  `https://orgfarm-077919cae5-dev-ed.develop.lightning.force.com`.
- **Multi-level child subqueries** in codegen (parser already accepts them).
- **`TYPEOF`** polymorphic SELECT.
- **`GROUP BY ROLLUP / CUBE`** with `GROUPING()` projection.
- **`dateAs: Date`** config option (deserialize ISO strings to `Date` in
  emitted row types).
- **`MultiPicklist` as `string[]`** helper.
- **Watch mode** (`soqlc generate --watch`).
- **Multi-org configs** — multiple `soql[]` entries today work, but lack
  per-entry auth context.

## Longer-term

- **Additional target languages**: Go, Kotlin, Python (matches sqlc's full
  matrix). Likely implemented as a plugin protocol (WASM or process) once
  the codegen interface stabilizes.
- **Bulk API 2.0** codegen path for large result sets.
- **Tooling API** support (`/tooling/query`) for metadata queries.
- **SOSL** (Salesforce Object Search Language) sibling codegen.
- **Override files** (à la sqlc's type overrides) for custom TS types per field.
- **Stored procedures / Apex invocable methods** — out of scope for soqlc;
  use the REST API directly.
