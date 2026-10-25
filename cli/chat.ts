import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { aiModel } from "@/lib/routing";
import { close } from "@/lib/db";
import { type Entry, investigate } from "@/lib/investigate";
import { providerNames, providers } from "@/lib/providers";
import { research } from "@/lib/research";
import { Session } from "@/lib/session";
import { asOperator } from "@/lib/tracing";
import { employeeTools } from "@/lib/tools";

const help = `/research <question>       answer from the company's sources, with citations
/investigate <question>    an agent searches the knowledge base and the web and writes a sourced report
/model [provider] [model]  switch models; no arguments lists them
/system [text]             show or replace the system prompt
/cost                      tokens and dollars spent in this session
/help                      show this text
/exit                      leave`;
const efforts = ["low", "medium", "high"] as const;

const usage = `Usage: pnpm chat [--provider <name>] [--model <id>] [--effort <level>] [--temperature <n>] [--max-tokens <n>] [--help]`;
const flags = `  --provider <name>     ${providerNames.join(", ")} (default anthropic)
  --model <id>          a model of the provider
  --effort <level>      ${efforts.join(", ")}
  --temperature <n>     a number
  --max-tokens <n>      a positive integer (default 2048)
  --help                print this text`;

function fail(message: string): never {
  console.error(`${message}\n${usage}\n${flags}`);
  process.exit(1);
}

function parse() {
  return parseArgs({
    options: {
      provider: { type: "string", default: "anthropic" },
      model: { type: "string" },
      effort: { type: "string" },
      temperature: { type: "string" },
      "max-tokens": { type: "string", default: "2048" },
      help: { type: "boolean", default: false },
    },
  });
}
let values: ReturnType<typeof parse>["values"];
try {
  values = parse().values;
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

if (values.help) {
  console.log(`${usage}\n${flags}\n\n${help}`);
  process.exit(0);
}

const provider = z.enum(providerNames).safeParse(values.provider);
if (!provider.success)
  fail(
    `Unknown provider "${values.provider}". Valid providers: ${providerNames.join(", ")}.`,
  );
const effort = z.enum(efforts).optional().safeParse(values.effort);
if (!effort.success)
  fail(
    `Unknown effort "${values.effort}". Valid efforts: ${efforts.join(", ")}.`,
  );
const maxTokens = Number(values["max-tokens"]);
if (!Number.isInteger(maxTokens) || maxTokens < 1)
  fail(
    `--max-tokens must be a positive integer, got "${values["max-tokens"]}".`,
  );
const temperature =
  values.temperature === undefined ? undefined : Number(values.temperature);
if (
  temperature !== undefined &&
  (values.temperature?.trim() === "" || !Number.isFinite(temperature))
)
  fail(`--temperature must be a finite number, got "${values.temperature}".`);

const session = new Session(provider.data, values.model, {
  tools: employeeTools,
  maxTokens,
  effort: effort.data,
  temperature,
});

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const clock = (at: Date) => at.toISOString().slice(11, 19);
/** One line of an investigation's log: the time, the agent, and what it thought, called or finished. */
const logLine = (e: Entry) =>
  e.kind === "thought"
    ? `${clock(e.at)} · ${short(e.text.replace(/\s+/g, " "))}`
    : e.kind === "tool"
      ? `${clock(e.at)} ⚙ ${e.name} ${brief(e.input)}${e.failed ? " failed" : ""}`
      : `${clock(e.at)} ✓ ${e.steps} steps, $${e.dollars.toFixed(4)}${e.stopped === "answered" ? "" : `, stopped: ${e.stopped}`}`;
// A log line is one line: a long thought or tool input, such as a report, is cut short.
const short = (text: string) =>
  text.length > 160 ? `${text.slice(0, 160)}…` : text;
const brief = (input: unknown) => short(JSON.stringify(input));

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
      if (args.length) {
        const named = z.enum(providerNames).safeParse(args[0]);
        if (!named.success)
          return `Unknown provider "${args[0]}". Valid providers: ${providerNames.join(", ")}.`;
        session.use(named.data, args[1]);
      }
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
      const run = await investigate(
        args.join(" "),
        aiModel(session.provider.name, session.model.id),
        { on: { log: (entry) => console.log(dim(logLine(entry))) } },
      );
      const why = run.stopped === "answered" ? "" : `, stopped: ${run.stopped}`;
      return `\n${run.report}\n${dim(`$${run.dollars.toFixed(4)}${why}`)}`;
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

// The terminal is the operator's: its tools run with an admin's role.
await asOperator("chat", async () => {
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
});
rl.close();
await close();
