# soqlc Documentation

soqlc is a TypeScript-native code generator for SOQL (Salesforce Object Query
Language) queries, inspired by [sqlc](https://github.com/sqlc-dev/sqlc).

## Index

- [architecture.md](architecture.md) — high-level pipeline (parse → analyze → codegen) and module responsibilities
- [config.md](config.md) — `soqlc.yaml` reference
- [schema-format.md](schema-format.md) — `schema.soql.json` reference
- [query-syntax.md](query-syntax.md) — `.soql` file conventions and the v0 supported SOQL subset
- [type-mapping.md](type-mapping.md) — SOQL field type → TypeScript type table
- [codegen.md](codegen.md) — what the generated code looks like and the runtime contract
- [roadmap.md](roadmap.md) — what's in v0 vs deferred

## Docs discipline

Every `src/` module has a corresponding section in one of these docs. When
changing a module, review the relevant doc first and update it as part of the
same change. New modules require a new doc section.

If you're not sure where to start, read `architecture.md` first.
