import type { Field } from "./model.js";

export const SYSTEM_FIELDS: ReadonlyArray<Field> = [
  { name: "Id", type: "Id", nillable: false },
  { name: "CreatedDate", type: "DateTime", nillable: false },
  { name: "LastModifiedDate", type: "DateTime", nillable: false },
  { name: "SystemModstamp", type: "DateTime", nillable: false },
  { name: "IsDeleted", type: "Boolean", nillable: false },
];

export function mergeSystemFields(declared: Field[]): Field[] {
  const have = new Set(declared.map((f) => f.name.toLowerCase()));
  const additions = SYSTEM_FIELDS.filter((f) => !have.has(f.name.toLowerCase()));
  return [...additions, ...declared];
}
