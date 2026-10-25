import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { aiModel } from "@/lib/chat";
import { close } from "@/lib/db";
import { investigate } from "@/lib/investigate";
import { providerNames, providers } from "@/lib/providers";
import { research } from "@/lib/research";
import { Session } from "@/lib/session";
import { tools } from "@/lib/tools";

const { values } = parseArgs({
  options: {
    provider: { type: "string", default: "anthropic" },
    model: { type: "string" },
    effort: { type: "string" },
    temperature: { type: "string" },
    "max-tokens": { type: "string", default: "2048" },
  },
});

const Provider = z.enum(providerNames);
const Effort = z.enum(["low", "medium", "high"]);

const session = new Session(Provider.parse(values.provider), values.model, {
  tools,
  maxTokens: Number(values["max-tokens"]),
  effort: values.effort === undefined ? undefined : Effort.parse(values.effort),
  temperature:
    values.temperature === undefined ? undefined : Number(values.temperature),
});

const help = `/research <question>       answer from the company's sources, with citations
/investigate <question>    an agent searches the knowledge base and the web and writes a sourced report
/model [provider] [model]  switch models; no arguments lists them
/system [text]             show or replace the system prompt
/cost                      tokens and dollars spent in this session
/exit                      leave`;

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
// A tool's input on one line; a long one, such as a report, is cut short.
const brief = (input: unknown) => {
  const text = JSON.stringify(input);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
};

async function command(line: string): Promise<string | null> {
  const [name, ...args] = line.slice(1).split(/\s+/);
  switch (name) {
    case "exit":
      return null;
    case "help":
      return help;
    case "cost": {
      const { input, output, dollars, unpriced } = session.cost();
      const note = unpriced.length
        ? `, not counting ${unpriced.join(", ")}, which has no published price`
        : "";
      return `${input} tokens in, ${output} out, $${dollars.toFixed(4)}${note}`;
    }
    case "system":
      if (args.length) session.system = args.join(" ");
      return session.system;
    case "model": {
      if (args.length) session.use(Provider.parse(args[0]), args[1]);
      const available = providerNames
        .map(
          (name) =>
            `${name}: ${providers[name]()
              .models.map((m) => m.id)
              .join(", ")}`,
        )
        .join("\n  ");
      return `using ${session.provider.name} ${session.model.id}\n  ${available}`;
    }
    case "research": {
      if (!args.length) return "Usage: /research <question>";
      const { usage } = await research(args.join(" "), session.provider, {
        step: (message) => console.log(dim(`· ${message}`)),
        text: (text) => stdout.write(text),
        spend: (model, usage) => session.record(model.id, usage, model.price),
      });
      return `\n${dim(`${usage.input} tokens in, ${usage.output} out`)}`;
    }
    case "investigate": {
      if (!args.length) return "Usage: /investigate <question>";
      const model = aiModel(session.provider.name, session.model.id);
      const run = await investigate(args.join(" "), model, {
        thought: (text) => console.log(dim(`· ${text}`)),
        tool: ({ name, input, failed }) =>
          console.log(
            dim(`⚙ ${name} ${brief(input)}${failed ? " failed" : ""}`),
          ),
      });
      session.record(session.model.id, run.usage, session.model.price);
      const why = run.stopped === "answered" ? "" : `, stopped: ${run.stopped}`;
      return `\n${run.report}\n${dim(`${run.steps} steps, ${run.usage.input} tokens in, ${run.usage.output} out${why}`)}`;
    }
    default:
      return `Unknown command /${name}. ${help}`;
  }
}

// Lines come through the async iterator, which queues input that arrives
// while a reply is streaming, so the loop works piped as well as interactive.
const rl = createInterface({ input: stdin, output: stdout, prompt: "you> " });
const prompt = () => stdin.isTTY && rl.prompt();
console.log(
  `WorkBot · ${session.provider.name} ${session.model.id} · /help for commands`,
);
prompt();

for await (const raw of rl) {
  const line = raw.trim();
  try {
    if (line.startsWith("/")) {
      const output = await command(line);
      if (output === null) break;
      console.log(output);
    } else if (line) {
      stdout.write("\nworkbot> ");
      await session.send(line, {
        text: (text) => stdout.write(text),
        tool: ({ name, input, failed }) =>
          stdout.write(
            dim(`\n⚙ ${name} ${brief(input)}${failed ? " failed" : ""}\n`),
          ),
      });
      stdout.write("\n\n");
    }
  } catch (err) {
    stdout.write(`\n${err instanceof Error ? err.message : String(err)}\n\n`);
  }
  prompt();
}
rl.close();
await close();
