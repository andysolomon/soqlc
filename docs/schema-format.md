# `schema.soql.json` reference

soqlc needs to know the shape of your Salesforce org (sObjects, fields,
relationships) to type-check queries. In v0 you author this JSON file
yourself.

## Authoring it from a real org (today)

soqlc does **not** yet have a built-in `pull-schema` command (it's on the
roadmap). In the meantime, the repo ships
[`scripts/from-sf-describe.ts`](../scripts/from-sf-describe.ts) — a thin
converter that takes one or more `sf sobject describe --json` payloads and
writes a valid `schema.soql.json` to stdout.

### Step 1 — authenticate the Salesforce CLI

```bash
sf org login web --alias dev-org \
  --instance-url https://your-instance.my.salesforce.com
```

A browser window opens; log in once and `sf` stores the credentials.

### Step 2 — describe the sObjects you query

```bash
sf sobject describe --sobject Account --target-org dev-org --json > account.describe.json
sf sobject describe --sobject Contact --target-org dev-org --json > contact.describe.json
```

### Step 3 — convert to `schema.soql.json`

```bash
tsx scripts/from-sf-describe.ts account.describe.json contact.describe.json > schema.soql.json
```

Or pipe a single sObject directly:

```bash
sf sobject describe --sobject Account --target-org dev-org --json \
  | tsx scripts/from-sf-describe.ts > schema.soql.json
```

### What the converter does

1. **Type names → PascalCase.** `sf` returns lowercase (`string`, `datetime`,
   `picklist`); the converter maps these to `String`, `DateTime`, `Picklist`,
   etc. — the full set is in `src/schema/model.ts`. Unknown types are
   skipped with a stderr warning.
2. **`picklistValues` → `string[]`.** `sf` returns
   `{ value, label, active }[]`; the converter keeps active values' `.value`
   strings.
3. **Anonymous child relationships are dropped** (they can't be referenced
   in SOQL anyway).

Everything else (`name`, `nillable`, `length`, `referenceTo`,
`relationshipName`, `childRelationships`) maps 1:1.

This will be superseded by `soqlc pull-schema` (see `roadmap.md`), which
will hide the two-step describe + convert dance behind one command.

## Example

```json
{
  "version": "1",
  "sObjects": [
    {
      "name": "Account",
      "fields": [
        { "name": "Id", "type": "Id", "nillable": false },
        { "name": "Name", "type": "String", "nillable": false, "length": 255 },
        { "name": "AnnualRevenue", "type": "Currency", "nillable": true },
        {
          "name": "Industry",
          "type": "Picklist",
          "nillable": true,
          "picklistValues": ["Tech", "Finance", "Healthcare"]
        }
      ],
      "childRelationships": [
        { "childSObject": "Contact", "field": "AccountId", "relationshipName": "Contacts" }
      ]
    },
    {
      "name": "Contact",
      "fields": [
        { "name": "Id", "type": "Id", "nillable": false },
        { "name": "FirstName", "type": "String", "nillable": true },
        { "name": "LastName", "type": "String", "nillable": false },
        { "name": "Email", "type": "Email", "nillable": true },
        {
          "name": "AccountId",
          "type": "Reference",
          "nillable": true,
          "referenceTo": ["Account"],
          "relationshipName": "Account"
        }
      ]
    }
  ]
}
```

## Top-level

| Field | Required | Description |
|---|---|---|
| `version` | yes | Schema format version. Must be `"1"`. |
| `sObjects` | yes | Array of sObject definitions. |

## sObject

| Field | Required | Description |
|---|---|---|
| `name` | yes | sObject API name (e.g. `Account`, `My_Object__c`). |
| `fields` | yes | Field definitions. |
| `childRelationships` | no | Parent-to-child relationships available in subqueries. |
| `includeSystemFields` | no | Default `true`. Set to `false` to suppress automatic injection of `CreatedDate`, `LastModifiedDate`, `SystemModstamp`, `IsDeleted`. |

## Field

| Field | Required | Description |
|---|---|---|
| `name` | yes | Field API name (e.g. `Name`, `My_Custom_Field__c`). |
| `type` | yes | SOQL field type — see `type-mapping.md`. |
| `nillable` | yes | Whether the field can be null. |
| `length` | no | For `String`/`TextArea`/`Phone`/etc. Informational only. |
| `picklistValues` | for `Picklist` / `MultiPicklist` | Used to emit a TS string literal union. |
| `referenceTo` | for `Reference` | Array of parent sObject names. The first entry is used for dot-walk in v0. |
| `relationshipName` | for `Reference` | Name used in child-to-parent dot notation (e.g. `Account` for `AccountId`). |

## childRelationship

| Field | Required | Description |
|---|---|---|
| `childSObject` | yes | Name of the child sObject. |
| `field` | yes | The Reference field on the child that points to this object. |
| `relationshipName` | yes | Plural relationship name used in parent-to-child subqueries (e.g. `Contacts`). |

## Built-in / system fields

Every sObject implicitly gets:

- `CreatedDate: DateTime` (non-null)
- `LastModifiedDate: DateTime` (non-null)
- `SystemModstamp: DateTime` (non-null)
- `IsDeleted: Boolean` (non-null)

Plus an `Id: Id` field if not already declared. Suppress via `"includeSystemFields": false`.
