# Query syntax (`.soql` files)

soqlc adopts sqlc's `-- name:` header convention. A `.soql` file may contain
many named queries; the file is split on those headers.

```sql
-- name: GetAccountById :one
SELECT Id, Name, Industry, AnnualRevenue
FROM Account
WHERE Id = :id;

-- name: ListAccountsByIndustry :many
SELECT Id, Name, AnnualRevenue
FROM Account
WHERE Industry = :industry
ORDER BY Name ASC
LIMIT :limit;

-- name: GetAccountWithContacts :one
SELECT Id, Name,
       (SELECT Id, FirstName, LastName, Email FROM Contacts)
FROM Account
WHERE Id = :id;
```

## Header

```
-- name: <Identifier> :<cardinality>
```

| Cardinality | Generated return type |
|---|---|
| `:one` | `Promise<Row \| null>` (returns `records[0] ?? null`) |
| `:many` | `Promise<Row[]>` (returns `records`) |

`:exec` is not meaningful — SOQL is a SELECT-only language. Use the Salesforce
REST `/composite/sobjects` or DML APIs directly for writes; those are out of
scope for soqlc.

## Statement termination

Statements end at `;` or end-of-file. Whitespace between statements is
ignored. Trailing comments are allowed.

## Bind parameters

soqlc uses `:name` placeholders, same syntax as Apex. The parameter type is
inferred from how it's used in the query (e.g. `WHERE Id = :id` makes
`id: string`).

At runtime, parameters are substituted client-side with proper SOQL escaping
before the query is sent to the REST API. See `codegen.md` for the binding
contract.

## v0 supported SOQL subset

**SELECT clause**
- Field paths: `Id`, `Account.Name`, `Account.Owner.Email` (parsed; v0
  analyzer guarantees one-level walk, deeper walks are allowed but the
  emitted type uses the shallowest nesting).
- Aggregates: `COUNT()`, `COUNT(field)`, `SUM(field)`, `AVG(field)`,
  `MIN(field)`, `MAX(field)`.
- Aliased columns: `COUNT(Id) total`.
- One level of child subquery: `(SELECT ... FROM Contacts)`.

**FROM** — single sObject. No `USING SCOPE` in v0.

**WHERE**
- Comparison: `=`, `!=`, `<`, `<=`, `>`, `>=`, `LIKE`, `IN`, `NOT IN`.
- Logical: `AND`, `OR`, `NOT`, parentheses.
- Literals: strings (`'foo'`), numbers, `TRUE`, `FALSE`, `NULL`, date literals.
- Bind params: `:name`.

**Date literals** — recognized as single tokens (no substitution needed):

`TODAY`, `YESTERDAY`, `TOMORROW`, `THIS_WEEK`, `LAST_WEEK`, `NEXT_WEEK`,
`THIS_MONTH`, `LAST_MONTH`, `NEXT_MONTH`, `THIS_QUARTER`, `LAST_QUARTER`,
`NEXT_QUARTER`, `THIS_YEAR`, `LAST_YEAR`, `NEXT_YEAR`, `LAST_N_DAYS:n`,
`NEXT_N_DAYS:n`, `LAST_N_WEEKS:n`, `NEXT_N_WEEKS:n`, `LAST_N_MONTHS:n`,
`NEXT_N_MONTHS:n`, `LAST_N_QUARTERS:n`, `NEXT_N_QUARTERS:n`,
`LAST_N_YEARS:n`, `NEXT_N_YEARS:n`, `N_DAYS_AGO:n`, `N_WEEKS_AGO:n`,
`N_MONTHS_AGO:n`, `N_QUARTERS_AGO:n`, `N_YEARS_AGO:n`.

**Optional clauses**
- `GROUP BY <field-list>`
- `HAVING <expr>`
- `ORDER BY <field> [ASC|DESC] [NULLS FIRST|NULLS LAST]`
- `LIMIT <int | :param>`
- `OFFSET <int | :param>`

## Deferred (not in v0)

- `TYPEOF` polymorphic SELECT
- `GROUP BY ROLLUP / CUBE`
- `WITH SECURITY_ENFORCED`, `WITH DATA CATEGORY`
- `USING SCOPE`
- `FOR VIEW / REFERENCE / UPDATE`
- Multi-level child subqueries (the parser accepts them; the analyzer rejects with a clear error)
- Geolocation functions (`DISTANCE`, `GEOLOCATION`)
- `convertCurrency()`, `convertTimezone()`, `Format()`, `toLabel()`

See `roadmap.md`.
