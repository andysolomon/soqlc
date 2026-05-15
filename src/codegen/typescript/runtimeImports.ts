export function emitRuntimeImport(specifier: string): string {
  return [
    `import type { SoqlClient } from ${JSON.stringify(specifier)};`,
    `import { bindParams } from ${JSON.stringify(specifier)};`,
  ].join("\n");
}
