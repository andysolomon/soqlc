export type SoqlFieldType =
  | "Id"
  | "String"
  | "TextArea"
  | "Phone"
  | "Email"
  | "URL"
  | "EncryptedString"
  | "Base64"
  | "Boolean"
  | "Int"
  | "Double"
  | "Currency"
  | "Percent"
  | "Date"
  | "DateTime"
  | "Time"
  | "Picklist"
  | "MultiPicklist"
  | "Reference"
  | "Address"
  | "Location";

export interface Field {
  name: string;
  type: SoqlFieldType;
  nillable: boolean;
  length?: number;
  picklistValues?: string[];
  referenceTo?: string[];
  relationshipName?: string;
}

export interface ChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string;
}

export interface SObject {
  name: string;
  fields: Field[];
  childRelationships: ChildRelationship[];
  includeSystemFields: boolean;
}

export interface Schema {
  version: string;
  sObjects: Map<string, SObject>;
}

export function findField(sobject: SObject, name: string): Field | undefined {
  const lower = name.toLowerCase();
  return sobject.fields.find((f) => f.name.toLowerCase() === lower);
}

export function findChildRelationship(
  sobject: SObject,
  relationshipName: string,
): ChildRelationship | undefined {
  const lower = relationshipName.toLowerCase();
  return sobject.childRelationships.find((r) => r.relationshipName.toLowerCase() === lower);
}

export function findParentRelationship(
  sobject: SObject,
  relationshipName: string,
): Field | undefined {
  const lower = relationshipName.toLowerCase();
  return sobject.fields.find(
    (f) => f.type === "Reference" && f.relationshipName?.toLowerCase() === lower,
  );
}
