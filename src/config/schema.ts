import { z } from "zod";

const tsGenSchema = z.object({
  out: z.string().min(1),
  client: z.literal("driverAgnostic").default("driverAgnostic"),
  emitRuntimeImport: z.string().default("@soqlc/runtime"),
  dateAs: z.enum(["string", "Date"]).default("string"),
  nullableMode: z.enum(["optional", "nullable"]).default("optional"),
});

const queriesField = z.union([z.string(), z.array(z.string()).min(1)]);

const entrySchema = z.object({
  schema: z.string().min(1),
  queries: queriesField,
  apiVersion: z.string().default("60.0"),
  gen: z.object({
    typescript: tsGenSchema,
  }),
});

export const configSchema = z.object({
  version: z.literal("1"),
  soql: z.array(entrySchema).min(1),
});

export type ConfigSchemaInput = z.input<typeof configSchema>;
export type ConfigSchemaOutput = z.output<typeof configSchema>;
