import type { NamedQuery } from "./ast.js";

const HEADER_RE = /^(?:--|\/\/)\s*name:\s*([A-Za-z_][A-Za-z0-9_]*)\s*:(one|many)\s*$/;

export interface QueryFileError {
  message: string;
  line: number;
}

export interface QueryFileResult {
  queries: NamedQuery[];
  errors: QueryFileError[];
}

export function parseQueryFile(text: string, filePath: string): QueryFileResult {
  const lines = text.split(/\r?\n/);
  const queries: NamedQuery[] = [];
  const errors: QueryFileError[] = [];

  let current: { name: string; cardinality: "one" | "many"; startLine: number; buf: string[] } | null =
    null;

  const flush = () => {
    if (!current) return;
    const source = current.buf.join("\n").replace(/;\s*$/, "").trim();
    if (source.length === 0) {
      errors.push({
        message: `Query "${current.name}" has no body`,
        line: current.startLine,
      });
      current = null;
      return;
    }
    queries.push({
      name: current.name,
      cardinality: current.cardinality,
      source,
      startLine: current.startLine,
      filePath,
    });
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const header = HEADER_RE.exec(line.trim());
    if (header) {
      flush();
      current = {
        name: header[1]!,
        cardinality: header[2] as "one" | "many",
        startLine: i + 1,
        buf: [],
      };
      continue;
    }
    if (current) {
      current.buf.push(line);
    } else {
      const trimmed = line.trim();
      const isComment = trimmed.startsWith("--") || trimmed.startsWith("//");
      if (trimmed.length > 0 && !isComment) {
        errors.push({
          message: "Statement before first `-- name:` (or `// name:`) header is ignored",
          line: i + 1,
        });
      }
    }
  }
  flush();

  const seen = new Set<string>();
  for (const q of queries) {
    if (seen.has(q.name)) {
      errors.push({
        message: `Duplicate query name "${q.name}"`,
        line: q.startLine,
      });
    }
    seen.add(q.name);
  }

  return { queries, errors };
}
