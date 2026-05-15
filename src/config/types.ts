export interface TypeScriptGenConfig {
  out: string;
  client: "driverAgnostic";
  emitRuntimeImport: string;
  dateAs: "string" | "Date";
  nullableMode: "optional" | "nullable";
}

export interface SoqlEntry {
  schema: string;
  queries: string[];
  apiVersion: string;
  gen: { typescript: TypeScriptGenConfig };
}

export interface SoqlcConfig {
  version: "1";
  soql: SoqlEntry[];
  /** Directory of the config file, used to resolve relative paths. */
  baseDir: string;
}
