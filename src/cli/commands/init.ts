import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeFileEnsuringDir } from "../../util/fs.js";
import type { Logger } from "../../util/logger.js";

export interface InitOptions {
  cwd: string;
  logger: Logger;
}

const CONFIG_TEMPLATE = `version: "1"
soql:
  - schema: ./schema.soql.json
    queries: ./queries/**/*.soql
    apiVersion: "60.0"
    gen:
      typescript:
        out: ./src/generated
        client: driverAgnostic
        emitRuntimeImport: "soqlc/runtime"
        dateAs: string
        nullableMode: optional
`;

const SCHEMA_TEMPLATE = `{
  "version": "1",
  "sObjects": [
    {
      "name": "Account",
      "fields": [
        { "name": "Id", "type": "Id", "nillable": false },
        { "name": "Name", "type": "String", "nillable": false }
      ]
    }
  ]
}
`;

const QUERY_TEMPLATE = `-- name: GetAccountById :one
SELECT Id, Name FROM Account WHERE Id = :id;
`;

export function runInit(opts: InitOptions): { written: string[] } {
  const written: string[] = [];
  const candidates: Array<[string, string]> = [
    [join(opts.cwd, "soqlc.yaml"), CONFIG_TEMPLATE],
    [join(opts.cwd, "schema.soql.json"), SCHEMA_TEMPLATE],
    [join(opts.cwd, "queries", "accounts.soql"), QUERY_TEMPLATE],
  ];
  for (const [path, content] of candidates) {
    if (existsSync(path)) {
      opts.logger.warn(`exists, skipping: ${path}`);
      continue;
    }
    writeFileEnsuringDir(path, content);
    written.push(path);
    opts.logger.info(`wrote ${path}`);
  }
  return { written };
}
