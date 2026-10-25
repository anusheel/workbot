import { type ToolSet, tool } from "ai";
import type { Access } from "./auth-model";
import type { Tool } from "./tool";
import { toolsFor } from "./tools";

/** Tools in the AI SDK's shape, each still checking the caller's role when it runs. */
export const toolSet = (tools: Tool[]): ToolSet =>
  Object.fromEntries(
    tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.input,
        execute: (input) => t.run(input),
      }),
    ]),
  );

/** The web chat's tools for a caller: the public gets the customer set, a signed-in employee what their role reaches. */
export const chatToolsFor = (role: Access): ToolSet => toolSet(toolsFor(role));
