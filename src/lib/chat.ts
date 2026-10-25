import { type ToolSet, tool } from "ai";
import type { Access } from "./auth-model";
import { toolsFor } from "./tools";

/** The web chat's tools for a caller, in the AI SDK's shape: the public gets the customer set, a signed-in employee what their role reaches. */
export const chatToolsFor = (role: Access): ToolSet =>
  Object.fromEntries(
    toolsFor(role).map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.input,
        execute: (input) => t.run(input),
      }),
    ]),
  );
