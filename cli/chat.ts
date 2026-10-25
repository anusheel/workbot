import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { close } from "@/lib/db";
import { providerNames, providers } from "@/lib/providers";
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

const help = `/model [provider] [model]  switch models; no arguments lists them
/system [text]             show or replace the system prompt
/cost                      tokens and dollars spent in this session
/exit                      leave`;

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

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
            dim(
              `\n⚙ ${name} ${JSON.stringify(input)}${failed ? " failed" : ""}\n`,
            ),
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
