/**
 * Substitute `:name` placeholders in a SOQL source string with SOQL-safe
 * literal forms. soqlc-generated code calls this before sending to the
 * Salesforce REST API.
 *
 * Rendering rules:
 *   string       -> 'value'   (single quotes doubled, backslashes escaped)
 *   number       -> 123
 *   bigint       -> 123
 *   boolean      -> true / false
 *   null/undef   -> null
 *   Date         -> ISO 8601, unquoted (Salesforce dateTime literal form)
 *   Array<T>     -> (elem, elem, ...) using these rules for each elem
 *   anything else-> JSON.stringify'd and quoted (with a warning)
 */
export type BindArgs = object;

export function bindParams(soql: string, args: BindArgs = {}): string {
  const bag = args as Record<string, unknown>;
  return soql.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_whole, name: string) => {
    if (!(name in bag)) {
      throw new Error(`bindParams: missing argument ":${name}"`);
    }
    return renderSoqlValue(bag[name]);
  });
}

export function renderSoqlValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return renderString(value);
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return "(" + value.map(renderSoqlValue).join(", ") + ")";
  }
  // Fallback: stringify defensively. Generated code should not hit this for
  // well-typed args, but it's better to send something than crash silently.
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn("bindParams: falling back to JSON.stringify for unsupported value", value);
  }
  return renderString(JSON.stringify(value));
}

function renderString(s: string): string {
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}
