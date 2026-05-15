import { Command } from "commander";
import { resolve } from "node:path";
import { printDiagnostics, runGenerate } from "./commands/generate.js";
import { runCompile } from "./commands/compile.js";
import { runInit } from "./commands/init.js";
import { makeLogger } from "../util/logger.js";
import { formatDiagnostic } from "../analyzer/errors.js";

const program = new Command();
program
  .name("soqlc")
  .description("Generate type-safe TypeScript code from SOQL queries")
  .option("-c, --config <path>", "path to soqlc.yaml", "soqlc.yaml")
  .option("--cwd <path>", "working directory", process.cwd())
  .option("--verbose", "verbose output", false)
  .option("--no-color", "disable colored output");

program
  .command("generate")
  .description("parse, analyze, and emit TypeScript output")
  .action(async () => {
    const opts = program.opts();
    const cwd = resolve(opts.cwd);
    const logger = makeLogger(!!opts.verbose);
    const { diagnostics, filesWritten } = await runGenerate({
      config: opts.config,
      cwd,
      logger,
    });
    if (diagnostics.length > 0) {
      printDiagnostics(diagnostics);
      process.exitCode = 1;
      return;
    }
    logger.info(`${filesWritten.length} file(s) generated`);
  });

program
  .command("compile")
  .description("parse + analyze only; report diagnostics")
  .action(async () => {
    const opts = program.opts();
    const cwd = resolve(opts.cwd);
    const logger = makeLogger(!!opts.verbose);
    const { diagnostics } = await runCompile({ config: opts.config, cwd, logger });
    if (diagnostics.length > 0) {
      for (const d of diagnostics) console.error(formatDiagnostic(d));
      process.exitCode = 1;
      return;
    }
    logger.info("ok");
  });

program
  .command("init")
  .description("scaffold soqlc.yaml, schema.soql.json, and queries/")
  .action(() => {
    const opts = program.opts();
    const cwd = resolve(opts.cwd);
    const logger = makeLogger(!!opts.verbose);
    runInit({ cwd, logger });
  });

await program.parseAsync(process.argv);
