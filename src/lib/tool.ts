import { z } from "zod";
import { type Access, permits } from "./auth-model";
import { currentContext } from "./tracing";

/** A function the model may call: who may call it, a schema for what it takes, and the code that runs it. */
export type Tool = {
  name: string;
  description: string;
  access: Access;
  input: z.ZodObject;
  run(input: unknown): Promise<string>;
};

/**
 * Defines a tool from the lowest role that may call it, a Zod schema and a
 * function. The caller's role is checked on every run, below the model and
 * whatever it was told, and the input is parsed on the way in, so defaults
 * apply and bad input fails the same way whoever calls it.
 */
export function tool<Schema extends z.ZodObject>(definition: {
  name: string;
  description: string;
  access: Access;
  input: Schema;
  run(input: z.infer<Schema>): string | Promise<string>;
}): Tool {
  return {
    ...definition,
    run: async (input) => {
      const { role = "public" } = currentContext();
      if (!permits(role, definition.access))
        throw new Error(
          `${definition.name} takes the ${definition.access} role, and this caller is ${role === "public" ? "not signed in" : `a ${role}`}.`,
        );
      return definition.run(definition.input.parse(input));
    },
  };
}

/** A tool's input as JSON Schema, which is what both providers take. */
export function inputSchema(tool: Tool) {
  const schema = z.toJSONSchema(tool.input);
  delete schema.$schema;
  return schema;
}
