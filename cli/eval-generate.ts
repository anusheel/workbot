import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Output, generateText } from "ai";
import { z } from "zod";
import { close, query } from "@/lib/db";
import { type DocumentType, schemas } from "@/lib/document-model";
import { type Golden, type IntakeCase } from "@/lib/eval";
import { customerSections } from "@/lib/knowledge-tools";
import {
  type Priority,
  type Team,
  priorities,
  teams,
} from "@/lib/request-model";
import { modelFor } from "@/lib/routing";

// Candidate cases for a person to review before any enters a set: chat cases
// written from a customer-facing document, triage cases written for a team and
// a priority or sampled from the requests people filed, and documents written
// with the record they should be read as. Nothing here is a case until it is
// reviewed and moved. Usage: pnpm eval:generate --task chat|triage|extract [--count 8]
const { values } = parseArgs({
  options: {
    task: { type: "string" },
    count: { type: "string", default: "8" },
  },
});
const count = Number(values.count);
const out = "content/eval/candidates";
await mkdir(out, { recursive: true });
const model = modelFor("generate");
const company =
  "Fieldstone Supply, a building-supply company with a warehouse in Oakland, 6 delivery vans, and operations, finance and support teams";

async function chat(): Promise<Golden[]> {
  const docs = (
    await Promise.all(
      customerSections.map(async (section) =>
        (await readdir(join("content/knowledge", section)))
          .filter((f) => f.endsWith(".md"))
          .map((f) => `${section}/${f}`),
      ),
    )
  ).flat();
  const picked = docs.sort(() => Math.random() - 0.5).slice(0, count);
  const Candidate = z.object({
    question: z.string(),
    criteria: z.array(z.string()).min(2).max(3),
    mustNotContain: z.array(z.string()).max(2),
  });
  return Promise.all(
    picked.map(async (path) => {
      const text = await readFile(join("content/knowledge", path), "utf8");
      const { output } = await generateText({
        model,
        output: Output.object({ schema: Candidate }),
        instructions: `You write evaluation cases for WorkBot, the assistant of ${company}. It answers from the company's documents and names the document it relied on.`,
        prompt: `Document ${path}:\n\n${text}\n\nWrite one case: a question a customer or an employee would ask that this document answers; 2 or 3 criteria a correct answer must meet, each checkable from the answer's text alone, one of them that the answer names \`${path}\` as its source; and up to 2 short phrases a wrong answer would contain, such as a wrong number or term that the document rules out.`,
      });
      const slug = path.replace(/^.*\//, "").replace(/\.md$/, "");
      return {
        id: `${slug}-synthetic`,
        kind: "answer",
        ...output,
        mustCall: [],
        source: "synthetic",
        smoke: false,
      };
    }),
  );
}

async function triage(): Promise<IntakeCase[]> {
  const sampled = await query<{
    id: string;
    body: string;
    team: Team;
    priority: Priority;
  }>(
    "select id, body, team, priority from requests where body <> '' order by created_at desc limit $1",
    [count],
  );
  const traced: IntakeCase[] = sampled.map((r) => ({
    id: `request-${r.id.slice(0, 8)}`,
    message: r.body,
    team: r.team,
    priority: r.priority,
    source: "trace",
    smoke: false,
  }));
  const grid = teams.flatMap((team) =>
    priorities.map((priority) => ({ team, priority })),
  );
  const written = await Promise.all(
    grid.slice(0, count).map(async ({ team, priority }, i) => {
      const { text } = await generateText({
        model,
        instructions: `You write test messages for the intake of ${company}. Only the message, 1 to 3 sentences, with a specific detail such as a name, a number or a place, and no greeting or signature.`,
        prompt: `A message an employee would send that belongs to the ${team} team at ${priority} priority (high when work or a customer is blocked, low for ideas and questions with no deadline, normal otherwise).`,
      });
      return {
        id: `${team}-${priority}-synthetic-${i}`,
        message: text.trim(),
        team,
        priority,
        source: "synthetic" as const,
        smoke: false,
      };
    }),
  );
  return [...traced, ...written];
}

async function extract() {
  const dir = "content/eval/documents";
  const existing = await readdir(dir);
  const kinds: DocumentType[] = ["invoice", "email", "letter", "job"];
  const next = (type: DocumentType) =>
    existing.filter((f) => f.startsWith(`${type}-`)).length + 1;
  const made: Record<string, { type: DocumentType; data: unknown }> = {};
  for (let i = 0; i < count; i++) {
    const type = kinds[i % kinds.length];
    const html = type === "invoice" || type === "letter";
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: z.object({ content: z.string(), data: schemas[type] }),
      }),
      instructions: `You write test documents for the document intake of ${company}, each with the record it must be read as.`,
      prompt: `Write a realistic ${type} as ${html ? "a complete HTML page with inline styles, as a real one would be printed" : "plain text, as it would arrive"}, and the record it should be read as, exactly as the schema says. Vary the names, dates and amounts from the obvious; totals must add up; every field in the record must be stated in the document.`,
    });
    const name = `${type}-${next(type) + Object.keys(made).filter((n) => n.startsWith(`${type}-`)).length}`;
    await writeFile(
      join(out, `${name}.${html ? "html" : "txt"}`),
      output.content,
    );
    made[name] = { type, data: output.data };
  }
  return made;
}

const made =
  values.task === "chat"
    ? await chat()
    : values.task === "triage"
      ? await triage()
      : values.task === "extract"
        ? await extract()
        : undefined;
if (!made) throw new Error("--task is chat, triage or extract");
const file = join(out, `${values.task}.json`);
await writeFile(file, `${JSON.stringify(made, null, 2)}\n`);
console.log(
  `${Array.isArray(made) ? made.length : Object.keys(made).length} candidates in ${file}`,
);
await close();
