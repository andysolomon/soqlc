import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";
import { configSchema } from "./schema.js";
import type { SoqlcConfig, SoqlEntry } from "./types.js";

export function loadConfig(configPath: string): SoqlcConfig {
  const absolute = isAbsolute(configPath) ? configPath : resolve(process.cwd(), configPath);
  const text = readFileSync(absolute, "utf8");
  const raw = absolute.endsWith(".json") ? JSON.parse(text) : YAML.parse(text);
  const parsed = configSchema.parse(raw);
  const baseDir = dirname(absolute);
  const soql: SoqlEntry[] = parsed.soql.map((entry) => ({
    schema: resolve(baseDir, entry.schema),
    queries: Array.isArray(entry.queries)
      ? entry.queries.map((g) => resolve(baseDir, g))
      : [resolve(baseDir, entry.queries)],
    apiVersion: entry.apiVersion,
    gen: {
      typescript: {
        out: resolve(baseDir, entry.gen.typescript.out),
        client: entry.gen.typescript.client,
        emitRuntimeImport: entry.gen.typescript.emitRuntimeImport,
        dateAs: entry.gen.typescript.dateAs,
        nullableMode: entry.gen.typescript.nullableMode,
      },
    },
  }));
  return {
    version: parsed.version,
    soql,
    baseDir,
  };
}
