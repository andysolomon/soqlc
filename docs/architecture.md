# Architecture

soqlc follows the same three-phase pipeline as sqlc:

```
.soql files  ─►  parse  ─►  analyze (vs. schema)  ─►  codegen  ─►  .ts files
schema       ─────────────────┘
```

Each phase is a separate module with no upstream dependencies; results flow
forward as plain data.

## Modules

### `src/schema/`
Loads `schema.soql.json` (validated by zod) into an in-memory model.

- `model.ts` — `SObject`, `Field`, `Relationship` types used by every later phase.
- `builtins.ts` — system fields (`Id`, `CreatedDate`, `LastModifiedDate`,
  `SystemModstamp`, `IsDeleted`) injected on every sObject unless suppressed.
- `loader.ts` — reads the JSON, applies builtins, returns a `Schema`.

### `src/parser/`
Turns raw `.soql` text into AST.

- `queryFileParser.ts` — splits a file into named queries on `-- name: <Name> :<cardinality>` headers.
- `lexer.ts` — Chevrotain tokens (keywords, date literals, identifiers, `:param`, literals).
- `grammar.ts` — Chevrotain `CstParser`; produces a Concrete Syntax Tree.
- `cstToAst.ts` — visitor that lowers CST nodes into the typed AST in `ast.ts`.
- `ast.ts` — AST node types (`SelectStmt`, `Column`, `Subquery`, `WhereExpr`, …).

### `src/analyzer/`
Walks each AST against the schema and produces a typed query description.

- `typeMap.ts` — SOQL field type → TypeScript type string (see `type-mapping.md`).
- `relationships.ts` — child-to-parent dot-walk and parent-to-child subquery resolution.
- `analyze.ts` — top-level entry; produces `AnalyzedQuery` with arg/row shapes and diagnostics.
- `errors.ts` — diagnostic types (collected, not thrown, so all issues surface in one run).

### `src/codegen/typescript/`
Emits TypeScript source from `AnalyzedQuery[]`.

- `emit.ts` — orchestrator (one .ts file per .soql file in v0).
- `emitQuery.ts` — per-query args interface, row interface, async function.
- `emitParamBinding.ts` — generates the `bindParams` call.
- `templates.ts` / `runtimeImports.ts` — string-template helpers and the `@soqlc/runtime` import line.

### `src/runtime/` (the `@soqlc/runtime` package)
Driver-agnostic runtime contract that generated code imports.

- `client.ts` — `SoqlClient` interface and `SoqlQueryResult<T>`.
- `bind.ts` — `bindParams(soql, args)`: SOQL-safe substitution (string escaping, date ISO formatting, list rendering, null handling).

### `src/config/`
Loads `soqlc.yaml` (validated by zod), produces a typed config object.

### `src/cli/`
Commander-based CLI: `soqlc generate`, `soqlc compile`, `soqlc init`.

## Data flow in one run of `soqlc generate`

1. `cli/commands/generate.ts` calls `config/loader.ts` to read `soqlc.yaml`.
2. For each `soql[]` entry: load the schema, glob the query files.
3. Each query file is split into named queries (`queryFileParser`).
4. Each query is lexed + parsed → CST → AST.
5. Each AST is analyzed against the schema → `AnalyzedQuery`.
6. All `AnalyzedQuery`s are passed to the codegen orchestrator, which writes
   `.ts` files into the `out` directory.

If any parse or analyze step fails, diagnostics are collected and the run
exits non-zero **after** processing every file (so users see all problems).
