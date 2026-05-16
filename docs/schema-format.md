# `schema.soql.json` reference

soqlc needs to know the shape of your Salesforce org (sObjects, fields,
relationships) to type-check queries. In v0 you author this JSON file
yourself.

## Authoring it from a real org (today)

soqlc does **not** yet ship a converter, but you can produce the JSON from a
connected org with the Salesforce CLI plus a small mapping step. `soqlc
pull-schema` will automate this in a later release (see `roadmap.md`).

```bash
sf sobject describe --sobject Account --target-org my-dev-org --json > account.describe.json
```

Two transformations are then needed to fit soqlc's schema shape:

1. **Type names are PascalCase.** `sf` returns lowercase (`string`,
   `datetime`, `picklist`); soqlc expects `String`, `DateTime`, `Picklist`
   (see the SOQL → TS table in `type-mapping.md`).
2. **`picklistValues` is a flat `string[]`.** `sf` returns an array of
   objects like `{ value, label, active }`. Extract `.value` and drop the
   inactive ones if you wish.

Everything else (`name`, `nillable`, `length`, `referenceTo`,
`relationshipName`, `childRelationships`) maps 1:1.

A minimal Node script is enough to do this conversion until `soqlc
pull-schema` lands.

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
