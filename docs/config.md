# `soqlc.yaml` reference

soqlc looks for `soqlc.yaml` in the current directory (or `--config <path>`).

## Example

```yaml
version: "1"
soql:
  - schema: ./schema.soql.json
    queries: ./queries/**/*.soql
    apiVersion: "60.0"
    gen:
      typescript:
        out: ./src/generated
        client: driverAgnostic
        emitRuntimeImport: "@soqlc/runtime"
        dateAs: string
        nullableMode: optional
```

## Top-level

| Field | Required | Description |
|---|---|---|
| `version` | yes | Must be `"1"`. Reserved for forward compatibility. |
| `soql` | yes | Array of generation targets. Run together in one pass. |

## `soql[]` entry

| Field | Required | Default | Description |
|---|---|---|---|
| `schema` | yes | — | Path to `schema.soql.json` (relative to the config). |
| `queries` | yes | — | Glob (or array of globs) matching `.soql` files. |
| `apiVersion` | no | `"60.0"` | Salesforce REST API version recorded in generated banners. Does not change codegen yet. |
| `gen.typescript` | yes (v0) | — | TypeScript output config. Other targets (`go`, `kotlin`, `python`) are deferred. |

## `gen.typescript`

| Field | Required | Default | Description |
|---|---|---|---|
| `out` | yes | — | Output directory. One `.ts` file per `.soql` source file. |
| `client` | no | `driverAgnostic` | v0 only supports `driverAgnostic`. Other values reserved. |
| `emitRuntimeImport` | no | `@soqlc/runtime` | Import specifier for the runtime package. Change if you re-export from your own module. |
| `dateAs` | no | `string` | `string` (ISO 8601) or `Date`. `Date` is reserved for a future release. |
| `nullableMode` | no | `optional` | `optional` → `T \| undefined`; `nullable` → `T \| null`. |

## CLI flags

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to config file. Defaults to `./soqlc.yaml`. |
| `--cwd <path>` | Working directory. All relative paths resolve from here. |
| `--verbose` | Verbose diagnostic output. |
| `--no-color` | Disable colored output. |

See `query-syntax.md` for the query file format, and `schema-format.md` for
the schema file format.
