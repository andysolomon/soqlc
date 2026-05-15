import { basename, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { glob } from "glob";
import { loadConfig } from "../../config/loader.js";
import { loadSchema } from "../../schema/loader.js";
import { parseSoql } from "../../parser/index.js";
import { parseQueryFile } from "../../parser/queryFileParser.js";
import { analyze, type AnalyzedQuery } from "../../analyzer/analyze.js";
import { emitFile } from "../../codegen/index.js";
import { writeFileEnsuringDir } from "../../util/fs.js";
import { formatDiagnostic, type Diagnostic } from "../../analyzer/errors.js";
import type { Logger } from "../../util/logger.js";

export interface GenerateOptions {
  config: string;
  cwd: string;
  logger: Logger;
}

export interface GenerateResult {
  diagnostics: Diagnostic[];
  filesWritten: string[];
}

export async function runGenerate(opts: GenerateOptions): Promise<GenerateResult> {
  const configPath = resolve(opts.cwd, opts.config);
  opts.logger.info(`config: ${configPath}`);
  const config = loadConfig(configPath);

  const diagnostics: Diagnostic[] = [];
  const filesWritten: string[] = [];

  for (const entry of config.soql) {
    const schema = loadSchema(entry.schema);
    opts.logger.info(`schema: ${entry.schema} (${schema.sObjects.size} sObjects)`);

    const queryFiles = (
      await Promise.all(
        entry.queries.map((pattern) => glob(pattern, { absolute: true })),
      )
    )
      .flat()
      .sort();

    opts.logger.info(`matched ${queryFiles.length} query files`);

    for (const queryFile of queryFiles) {
      const text = readFileSync(queryFile, "utf8");
      const { queries, errors } = parseQueryFile(text, queryFile);
      for (const e of errors) {
        diagnostics.push({ message: e.message, filePath: queryFile, line: e.line, column: 1 });
      }

      const analyzed: AnalyzedQuery[] = [];
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
        if (result.query) analyzed.push(result.query);
      }

      if (analyzed.length === 0) continue;
      const outName = basename(queryFile).replace(/\.soql$/i, ".ts");
      const outPath = join(entry.gen.typescript.out, outName);
      const content = emitFile(analyzed, {
        runtimeImportSpecifier: entry.gen.typescript.emitRuntimeImport,
      });
      writeFileEnsuringDir(outPath, content);
      filesWritten.push(outPath);
      opts.logger.info(`wrote ${outPath}`);
    }
  }

  return { diagnostics, filesWritten };
}

export function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    console.error(formatDiagnostic(d));
  }
}
