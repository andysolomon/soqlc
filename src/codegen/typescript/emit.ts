import type { AnalyzedQuery } from "../../analyzer/analyze.js";
import { emitQuery } from "./emitQuery.js";
import { emitRuntimeImport } from "./runtimeImports.js";
import { GENERATED_BANNER } from "./templates.js";

export interface EmitOptions {
  runtimeImportSpecifier: string;
}

/**
 * Emit a single TypeScript file for one source `.soql` file's worth of queries.
 */
export function emitFile(queries: AnalyzedQuery[], options: EmitOptions): string {
  const importLine = emitRuntimeImport(options.runtimeImportSpecifier);
  const bodies = queries.map(emitQuery).join("\n");
  return [GENERATED_BANNER, importLine, "", bodies].join("\n");
}
