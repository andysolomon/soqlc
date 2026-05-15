# SOQL → TypeScript type mapping

The canonical mapping table lives in `src/analyzer/typeMap.ts`. This document
mirrors it.

## Scalar types

| SOQL field type | v0 TS type | Notes |
|---|---|---|
| `Id` | `string` | 18-char Salesforce IDs. |
| `String`, `TextArea`, `Phone`, `Email`, `URL`, `EncryptedString`, `Base64` | `string` | |
| `Boolean` | `boolean` | |
| `Int` | `number` | |
| `Double`, `Currency`, `Percent` | `number` | |
| `Date`, `DateTime`, `Time` | `string` | ISO 8601. `Date`-as-`Date` flag is reserved. |
| `Picklist` | string literal union of `picklistValues` | e.g. `"Tech" \| "Finance" \| "Healthcare"`. Falls back to `string` if `picklistValues` is empty. |
| `MultiPicklist` | `string` | Salesforce returns semicolon-joined. `string[]` helper is deferred. |
| `Reference` | `string` | The foreign-key Id. Use a relationship traversal in the query to also get the parent row. |
| `Address`, `Location` | `Record<string, unknown>` | Refined in a later release. |
| anything else | `unknown` | Diagnostic emitted; treat unknown SOQL types as opaque. |

## Nullability

A field with `"nillable": true` becomes `T | undefined` by default. With
`nullableMode: nullable` in the config, it becomes `T | null` instead.

Aggregates (`COUNT`, `SUM`, …) always produce non-nullable `number`.

## Relationships

### Child-to-parent (dot notation)

A query like:

```sql
SELECT Id, Account.Name FROM Contact
```

produces a row type like:

```ts
{ Id: string; Account: { Name: string } | null }
```

The parent object is nullable because the underlying Reference field
(`AccountId`) is typically nillable.

### Parent-to-child (subquery)

A query like:

```sql
SELECT Id, (SELECT Id, FirstName FROM Contacts) FROM Account
```

produces:

```ts
{
  Id: string;
  Contacts: {
    totalSize: number;
    done: boolean;
    records: { Id: string; FirstName: string | undefined }[];
  } | null;
}
```

This matches the JSON shape Salesforce returns.

## Picklist literal narrowing

If `Industry` has `picklistValues: ["Tech", "Finance", "Healthcare"]`:

- non-null: `"Tech" | "Finance" | "Healthcare"`
- nullable: `"Tech" | "Finance" | "Healthcare" | undefined`

If `picklistValues` is empty/absent, the type degrades to `string`.

## Aliases

```sql
SELECT COUNT(Id) total, AVG(AnnualRevenue) avgRev FROM Account
```

emits a row type using the aliases:

```ts
{ total: number; avgRev: number }
```

Without an alias, anonymous aggregates use Salesforce's `expr0`, `expr1`, …
naming.
