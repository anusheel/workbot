import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";
import { NewRequest, priorities, teams } from "./request-model";
import { createRequest } from "./requests";

const Triage = z.object({
  title: z
    .string()
    .min(3)
    .max(120)
    .describe("what is being asked, as a short imperative line"),
  body: z
    .string()
    .max(5000)
    .describe(
      "the request in the sender's words, cleaned of greetings and signatures",
    ),
  team: z
    .enum(teams)
    .describe(
      "operations for facilities, vendors and logistics; finance for money; support for customers",
    ),
  priority: z
    .enum(priorities)
    .describe(
      "high when work or a customer is blocked, low for ideas and questions with no deadline",
    ),
});
export type Triage = z.infer<typeof Triage>;

/** Reads an incoming message and decides the title, team and priority, as the intake form's fields. */
export async function triage(
  message: string,
  model: LanguageModel,
): Promise<Triage> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Triage }),
    instructions:
      "You triage messages sent to Fieldstone Supply's operations, finance and support teams. Turn the message into a work request: a short title, the body in the sender's words, the team that owns it and a priority.",
    prompt: message,
  });
  return output;
}

/**
 * The intake workflow: a message comes in, triage decides where it goes, and
 * a request is created for a person to review in the queue.
 */
export async function intake(message: string, model: LanguageModel) {
  return createRequest(NewRequest.parse(await triage(message, model)));
}
