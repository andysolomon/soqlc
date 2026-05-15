import type { Field, SoqlFieldType } from "../schema/model.js";

export interface TypeMapOptions {
  nullableMode: "optional" | "nullable";
  dateAs: "string" | "Date";
}

export const DEFAULT_TYPE_MAP_OPTIONS: TypeMapOptions = {
  nullableMode: "optional",
  dateAs: "string",
};

/**
 * Map a SOQL field type (with the field metadata available for picklists) to
 * a TypeScript type literal string. Nullability is handled by callers via
 * `applyNullability`.
 */
export function soqlTypeToTs(field: Field, options: TypeMapOptions): string {
  const t = field.type;
  switch (t) {
    case "Id":
    case "String":
    case "TextArea":
    case "Phone":
    case "Email":
    case "URL":
    case "EncryptedString":
    case "Base64":
    case "Reference":
      return "string";
    case "Boolean":
      return "boolean";
    case "Int":
    case "Double":
    case "Currency":
    case "Percent":
      return "number";
    case "Date":
    case "DateTime":
    case "Time":
      return options.dateAs === "Date" ? "Date" : "string";
    case "Picklist": {
      const values = field.picklistValues ?? [];
      if (values.length === 0) return "string";
      return values.map((v) => JSON.stringify(v)).join(" | ");
    }
    case "MultiPicklist":
      return "string";
    case "Address":
    case "Location":
      return "Record<string, unknown>";
    default: {
      const exhaustive: never = t;
      void exhaustive;
      return "unknown";
    }
  }
}

export function applyNullability(
  tsType: string,
  nillable: boolean,
  options: TypeMapOptions,
): string {
  if (!nillable) return tsType;
  return options.nullableMode === "nullable" ? `${tsType} | null` : `${tsType} | undefined`;
}

export function isOptionalProperty(nillable: boolean, options: TypeMapOptions): boolean {
  return nillable && options.nullableMode === "optional";
}

export const SOQL_FIELD_TYPES: SoqlFieldType[] = [
  "Id",
  "String",
  "TextArea",
  "Phone",
  "Email",
  "URL",
  "EncryptedString",
  "Base64",
  "Boolean",
  "Int",
  "Double",
  "Currency",
  "Percent",
  "Date",
  "DateTime",
  "Time",
  "Picklist",
  "MultiPicklist",
  "Reference",
  "Address",
  "Location",
];
