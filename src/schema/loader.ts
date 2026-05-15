import { readFileSync } from "node:fs";
import { z } from "zod";
import type { ChildRelationship, Field, SObject, Schema, SoqlFieldType } from "./model.js";
import { mergeSystemFields } from "./builtins.js";

const SOQL_TYPES: SoqlFieldType[] = [
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

const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(SOQL_TYPES as [SoqlFieldType, ...SoqlFieldType[]]),
  nillable: z.boolean(),
  length: z.number().int().positive().optional(),
  picklistValues: z.array(z.string()).optional(),
  referenceTo: z.array(z.string()).optional(),
  relationshipName: z.string().optional(),
});

const childRelationshipSchema = z.object({
  childSObject: z.string().min(1),
  field: z.string().min(1),
  relationshipName: z.string().min(1),
});

const sObjectSchema = z.object({
  name: z.string().min(1),
  fields: z.array(fieldSchema),
  childRelationships: z.array(childRelationshipSchema).optional(),
  includeSystemFields: z.boolean().optional(),
});

const schemaFileSchema = z.object({
  version: z.literal("1"),
  sObjects: z.array(sObjectSchema),
});

export function loadSchemaFromString(text: string, sourcePath?: string): Schema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const where = sourcePath ? ` (${sourcePath})` : "";
    throw new Error(`Failed to parse schema JSON${where}: ${(err as Error).message}`);
  }
  const data = schemaFileSchema.parse(parsed);
  const sObjects = new Map<string, SObject>();
  for (const raw of data.sObjects) {
    const includeSystemFields = raw.includeSystemFields ?? true;
    const fields: Field[] = includeSystemFields
      ? mergeSystemFields(raw.fields as Field[])
      : (raw.fields as Field[]);
    const childRelationships: ChildRelationship[] = raw.childRelationships ?? [];
    sObjects.set(raw.name.toLowerCase(), {
      name: raw.name,
      fields,
      childRelationships,
      includeSystemFields,
    });
  }
  return { version: data.version, sObjects };
}

export function loadSchema(path: string): Schema {
  const text = readFileSync(path, "utf8");
  return loadSchemaFromString(text, path);
}

export function getSObject(schema: Schema, name: string): SObject | undefined {
  return schema.sObjects.get(name.toLowerCase());
}
