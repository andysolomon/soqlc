import type { FieldPath } from "../parser/ast.js";
import type { Field, SObject, Schema } from "../schema/model.js";
import { findChildRelationship, findField, findParentRelationship } from "../schema/model.js";
import { getSObject } from "../schema/loader.js";

export interface ResolvedFieldPath {
  /** Final field metadata (the leaf). */
  field: Field;
  /** The chain of parent relationships walked, in order. Empty for a bare field. */
  parents: { relationshipName: string; sobject: SObject; nillable: boolean }[];
}

export interface FieldResolutionFailure {
  reason: string;
  atSegment: number;
}

/**
 * Resolve a dotted field path (e.g. ["Account", "Name"]) starting from a root
 * sObject. Each non-final segment must be the relationshipName of a Reference
 * field on the previous sObject.
 */
export function resolveFieldPath(
  schema: Schema,
  root: SObject,
  path: FieldPath,
): { ok: true; resolved: ResolvedFieldPath } | { ok: false; failure: FieldResolutionFailure } {
  const segments = path.segments;
  let current: SObject = root;
  const parents: ResolvedFieldPath["parents"] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const rel = findParentRelationship(current, segment);
    if (!rel || !rel.referenceTo || rel.referenceTo.length === 0) {
      return {
        ok: false,
        failure: { reason: `No parent relationship "${segment}" on ${current.name}`, atSegment: i },
      };
    }
    const parentName = rel.referenceTo[0]!;
    const parent = getSObject(schema, parentName);
    if (!parent) {
      return {
        ok: false,
        failure: {
          reason: `Parent sObject "${parentName}" referenced by ${current.name}.${segment} not in schema`,
          atSegment: i,
        },
      };
    }
    parents.push({ relationshipName: rel.relationshipName!, sobject: parent, nillable: rel.nillable });
    current = parent;
  }

  const leafName = segments[segments.length - 1]!;
  const field = findField(current, leafName);
  if (!field) {
    return {
      ok: false,
      failure: { reason: `Unknown field "${leafName}" on ${current.name}`, atSegment: segments.length - 1 },
    };
  }
  return { ok: true, resolved: { field, parents } };
}

export function resolveChildRelationship(parent: SObject, relationshipName: string) {
  return findChildRelationship(parent, relationshipName);
}
