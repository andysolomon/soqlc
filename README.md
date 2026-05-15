# soqlc

Generate **type-safe TypeScript** code from SOQL queries.

soqlc is to SOQL what [sqlc](https://github.com/sqlc-dev/sqlc) is to SQL: you
write `.soql` files and a schema describing your sObjects, and soqlc emits
strongly-typed TypeScript functions that execute those queries through a
driver-agnostic client interface.

```bash
soqlc generate     # parse + analyze + emit code
soqlc compile      # parse + analyze only (no output)
soqlc init         # scaffold a new project
```

## Status

**v0 — TypeScript only.** Go, Kotlin, and Python codegen are planned but
deferred. See `docs/roadmap.md`.

## How it works

```
.soql query files  ─┐
                    ├──►  parse  ──►  analyze (against schema)  ──►  emit TS
schema.soql.json   ─┘
```

The emitted TypeScript imports a `SoqlClient` interface from `@soqlc/runtime`.
You implement (or adapt) that interface using jsforce, `@salesforce/core`, or
plain `fetch`. soqlc doesn't tie you to a particular Salesforce SDK.

## Quick start

```bash
pnpm install
pnpm soqlc init
# edit schema.soql.json + queries/*.soql
pnpm soqlc generate
```

See `examples/basic/` for a runnable example with a fake in-memory client.

## Docs

- [docs/architecture.md](docs/architecture.md) — parse → analyze → codegen pipeline
- [docs/config.md](docs/config.md) — `soqlc.yaml` reference
- [docs/schema-format.md](docs/schema-format.md) — `schema.soql.json` reference
- [docs/query-syntax.md](docs/query-syntax.md) — `.soql` file conventions + supported subset
- [docs/type-mapping.md](docs/type-mapping.md) — SOQL → TypeScript type mapping
- [docs/codegen.md](docs/codegen.md) — emitted code shape + runtime contract
- [docs/roadmap.md](docs/roadmap.md) — what's deferred

## License

MIT — see [LICENSE](LICENSE). Inspired by [sqlc](https://github.com/sqlc-dev/sqlc) (also MIT).
