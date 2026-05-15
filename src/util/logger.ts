export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function makeLogger(verbose: boolean): Logger {
  return {
    info(msg) {
      if (verbose) console.error(`[soqlc] ${msg}`);
    },
    warn(msg) {
      console.error(`[soqlc warn] ${msg}`);
    },
    error(msg) {
      console.error(`[soqlc error] ${msg}`);
    },
  };
}
