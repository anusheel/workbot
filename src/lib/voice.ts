import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";
import { intake } from "./intake";
import type { WorkRequest } from "./request-model";
import type { Turn } from "./voice-model";

export type { Turn } from "./voice-model";

export const Turns = z
  .array(
    z.object({
      role: z.enum(["caller", "workbot"]),
      text: z.string().min(1).max(2_000),
    }),
  )
  .min(1)
  .max(40);

const Reply = z.object({
  say: z
    .string()
    .min(1)
    .max(300)
    .describe("the next thing to say to the caller: 1 or 2 short sentences"),
  done: z
    .boolean()
    .describe(
      "true when what happened, who or what is affected, and how urgent it is are all known",
    ),
});

const instructions = `You answer Fieldstone Supply's support line for employees. Find out what happened, who or what is affected, and how urgent it is, one question at a time, in plain spoken sentences a person can listen to: short, no lists, no markdown. Ask at most 2 questions in a call. When all 3 are known, or after the second answer, say that you are filing the request and that the team will follow up, and set done. If the caller asks a question instead of reporting a problem, answer briefly and ask what you can file for them.`;

const transcript = (turns: Turn[]) =>
  turns
    .map((t) => `${t.role === "caller" ? "Caller" : "WorkBot"}: ${t.text}`)
    .join("\n");

/**
 * One turn of the call: what to say next and, when the caller has said
 * enough, the request filed from their words through the intake workflow.
 */
export async function voiceTurn(
  turns: Turn[],
  model: LanguageModel,
): Promise<{ say: string; request?: WorkRequest }> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Reply }),
    instructions,
    prompt: transcript(turns),
  });
  if (!output.done) return { say: output.say };
  const request = await intake(
    turns
      .filter((t) => t.role === "caller")
      .map((t) => t.text)
      .join("\n"),
    model,
  );
  return {
    say: `${output.say} It is with the ${request.team} team as "${request.title}".`,
    request,
  };
}
