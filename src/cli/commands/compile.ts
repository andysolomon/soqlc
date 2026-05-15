import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { glob } from "glob";
import { loadConfig } from "../../config/loader.js";
import { loadSchema } from "../../schema/loader.js";
import { parseSoql } from "../../parser/index.js";
import { parseQueryFile } from "../../parser/queryFileParser.js";
import { analyze } from "../../analyzer/analyze.js";
import type { Diagnostic } from "../../analyzer/errors.js";
import type { Logger } from "../../util/logger.js";

export interface CompileOptions {
  config: string;
  cwd: string;
  logger: Logger;
}

export async function runCompile(opts: CompileOptions): Promise<{ diagnostics: Diagnostic[] }> {
  const configPath = resolve(opts.cwd, opts.config);
  const config = loadConfig(configPath);

  const diagnostics: Diagnostic[] = [];

  for (const entry of config.soql) {
    const schema = loadSchema(entry.schema);
    const queryFiles = (
      await Promise.all(entry.queries.map((p) => glob(p, { absolute: true })))
    ).flat();

    for (const queryFile of queryFiles) {
      const text = readFileSync(queryFile, "utf8");
      const { queries, errors } = parseQueryFile(text, queryFile);
      for (const e of errors) {
        diagnostics.push({ message: e.message, filePath: queryFile, line: e.line, column: 1 });
      }
      for (const q of queries) {
        const parseResult = parseSoql(q.source);
        if (parseResult.errors.length > 0 || !parseResult.ast) {
          for (const err of parseResult.errors) {
            diagnostics.push({
              message: `parse: ${err.message}`,
              filePath: queryFile,
              line: q.startLine + err.line - 1,
              column: err.column,
              queryName: q.name,
            });
          }
          continue;
        }
        const result = analyze(
          parseResult.ast,
          {
            name: q.name,
            cardinality: q.cardinality,
            filePath: queryFile,
            startLine: q.startLine,
            source: q.source,
          },
          schema,
          {
            typeMap: {
              nullableMode: entry.gen.typescript.nullableMode,
              dateAs: entry.gen.typescript.dateAs,
            },
          },
        );
        diagnostics.push(...result.diagnostics);
      }
    }
  }
  return { diagnostics };
}
