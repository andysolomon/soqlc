#!/usr/bin/env tsx
/**
 * Convert one or more `sf sobject describe --json` outputs into a single
 * `schema.soql.json` that soqlc accepts.
 *
 * Usage:
 *   tsx scripts/from-sf-describe.ts <describe1.json> [<describe2.json> ...] > schema.soql.json
 *
 * Or pipe a single describe directly:
 *   sf sobject describe --sobject Account --target-org dev-org --json \
 *     | tsx scripts/from-sf-describe.ts > schema.soql.json
 *
 * This is a stopgap until `soqlc pull-schema` lands (see docs/roadmap.md).
 */
import { readFileSync } from "node:fs";

interface SfPicklistValue {
  value: string;
  label?: string;
  active?: boolean;
}

interface SfField {
  name: string;
  type: string;
  nillable: boolean;
  length?: number;
  picklistValues?: SfPicklistValue[];
  referenceTo?: string[];
  relationshipName?: string | null;
}

interface SfChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string | null;
}

interface SfDescribeResult {
  name: string;
  fields: SfField[];
  childRelationships?: SfChildRelationship[];
}

interface SfDescribePayload {
  status?: number;
  result?: SfDescribeResult;
  // some versions of sf put the describe at the top level
  name?: string;
  fields?: SfField[];
  childRelationships?: SfChildRelationship[];
}

const TYPE_MAP: Record<string, string> = {
  id: "Id",
  string: "String",
  textarea: "TextArea",
  phone: "Phone",
  email: "Email",
  url: "URL",
  encryptedstring: "EncryptedString",
  base64: "Base64",
  boolean: "Boolean",
  int: "Int",
  double: "Double",
  currency: "Currency",
  percent: "Percent",
  date: "Date",
  datetime: "DateTime",
  time: "Time",
  picklist: "Picklist",
  multipicklist: "MultiPicklist",
  reference: "Reference",
  address: "Address",
  location: "Location",
};

function mapType(sfType: string): string | undefined {
  return TYPE_MAP[sfType.toLowerCase()];
}

function unwrap(payload: SfDescribePayload): SfDescribeResult {
  if (payload.result && payload.result.name) return payload.result;
  if (payload.status === 2 || (payload as { code?: number }).code === 2) {
    const err = payload as unknown as { message?: string };
    throw new Error(
      `sf returned an error payload (not authorized?): ${err.message ?? "unknown error"}`,
    );
  }
  if (payload.name && payload.fields) {
    return {
      name: payload.name,
      fields: payload.fields,
      childRelationships: payload.childRelationships,
    };
  }
  throw new Error("Input does not look like a sf sobject describe payload");
}

function convertField(field: SfField): Record<string, unknown> | null {
  const mapped = mapType(field.type);
  if (!mapped) {
    process.stderr.write(
      `[from-sf-describe] skipping field ${field.name}: unsupported type "${field.type}"\n`,
    );
    return null;
  }
  const out: Record<string, unknown> = {
    name: field.name,
    type: mapped,
    nillable: !!field.nillable,
  };
  if (typeof field.length === "number" && field.length > 0) out.length = field.length;
  if (field.picklistValues && field.picklistValues.length > 0) {
    out.picklistValues = field.picklistValues
      .filter((p) => p.active !== false)
      .map((p) => p.value);
  }
  if (field.referenceTo && field.referenceTo.length > 0) {
    out.referenceTo = field.referenceTo;
  }
  if (field.relationshipName) {
    out.relationshipName = field.relationshipName;
  }
  return out;
}

function convert(payload: SfDescribePayload) {
  const sob = unwrap(payload);
  const fields = sob.fields.map(convertField).filter((f) => f !== null);
  const childRelationships = (sob.childRelationships ?? [])
    .filter((c) => c.relationshipName) // anonymous child rels are unusable in SOQL
    .map((c) => ({
      childSObject: c.childSObject,
      field: c.field,
      relationshipName: c.relationshipName!,
    }));
  return { name: sob.name, fields, childRelationships };
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const inputs: string[] = [];
  if (args.length === 0) {
    inputs.push(await readStdin());
  } else {
    for (const path of args) {
      inputs.push(readFileSync(path, "utf8"));
    }
  }
  const sObjects = inputs.map((text) => convert(JSON.parse(text)));
  const schema = { version: "1", sObjects };
  process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
