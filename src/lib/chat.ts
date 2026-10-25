import { type ToolSet, tool } from "ai";
import { customerTools } from "./tools";

/**
 * The web chat's tools in the AI SDK's shape. Until there is a sign-in, the
 * web is a public surface, so it gets the customer set.
 */
export const chatTools: ToolSet = Object.fromEntries(
  customerTools.map((t) => [
    t.name,
    tool({
      description: t.description,
      inputSchema: t.input,
      execute: (input) => t.run(input),
    }),
  ]),
);
