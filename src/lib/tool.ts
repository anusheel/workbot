import { z } from "zod";

/** A function the model may call: a schema for what it takes and the code that runs it. */
export type Tool = {
  name: string;
  description: string;
  input: z.ZodObject;
  run(input: unknown): Promise<string>;
};

/**
 * Defines a tool from a Zod schema and a function. The input is parsed on the
 * way in, so defaults apply and bad input fails the same way whoever calls it.
 */
export function tool<Schema extends z.ZodObject>(definition: {
  name: string;
  description: string;
  input: Schema;
  run(input: z.infer<Schema>): string | Promise<string>;
}): Tool {
  return {
    ...definition,
    run: async (input) => definition.run(definition.input.parse(input)),
  };
}

/** A tool's input as JSON Schema, which is what both providers take. */
export function inputSchema(tool: Tool) {
  const schema = z.toJSONSchema(tool.input);
  delete schema.$schema;
  return schema;
}
