import type { Entity, Field } from "./entity-model";

export type Generated = { path: string; source: string };

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const snake = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const label = (f: Field) =>
  f.label ?? cap(f.name.replace(/([A-Z])/g, " $1").toLowerCase());
const header = (e: Entity) =>
  `// Generated from content/entities/${e.name}.json by pnpm generate. Edit the description, not this file.`;

/** The column a field becomes: required fields are not null; a choice carries its default; text defaults to empty. */
function column(f: Field) {
  const type = f.type === "number" ? "numeric" : "text";
  if (f.type === "choice")
    return `${snake(f.name)} text not null default '${f.default ?? f.options![0]}'`;
  if (f.required) return `${snake(f.name)} ${type} not null`;
  if (f.type === "text") return `${snake(f.name)} text not null default ''`;
  return `${snake(f.name)} ${type}`;
}

/** The Zod type a field becomes, as the API and the form parse it. */
function zodType(e: Entity, f: Field) {
  switch (f.type) {
    case "choice":
      return `z.enum(${e.name}${cap(f.name)}).default("${f.default ?? f.options![0]}")`;
    case "number":
      return f.required
        ? "z.coerce.number()"
        : "z.coerce.number().nullable().default(null)";
    case "email":
      return f.required ? "z.email()" : "z.email().nullable().default(null)";
    case "phone":
      return f.required
        ? "z.string().trim().min(7).max(40)"
        : "z.string().trim().min(7).max(40).nullable().default(null)";
    case "text": {
      const max = f.max ?? 200;
      return f.required
        ? `z.string().trim().min(1).max(${max})`
        : `z.string().trim().max(${max}).default("")`;
    }
  }
}

/** A value a test can send for a field. */
function sample(f: Field): string | number {
  switch (f.type) {
    case "choice":
      return f.options![0];
    case "number":
      return 42;
    case "email":
      return "sample@example.com";
    case "phone":
      return "+15035550100";
    case "text":
      return `Sample ${label(f).toLowerCase()}`;
  }
}

const input = (e: Entity, f: Field) => {
  const common = `id="${f.name}" name="${f.name}"${f.required ? " required" : ""}`;
  const control =
    f.type === "choice"
      ? `<NativeSelect ${common} defaultValue="${f.default ?? f.options![0]}">
          {${e.name}${cap(f.name)}.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>`
      : f.multiline
        ? `<Textarea ${common} rows={3}${f.max ? ` maxLength={${f.max}}` : ""} />`
        : `<Input ${common} type="${f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.type === "number" ? "number" : "text"}"${f.max ? ` maxLength={${f.max}}` : ""} />`;
  return `<div className="grid gap-2${f.multiline ? " sm:col-span-2" : ""}">
        <Label htmlFor="${f.name}">${label(f)}</Label>
        ${control}
      </div>`;
};

/** Everything one entity becomes: its module, its route with types and a test, its page with its action. */
export function generate(e: Entity): Generated[] {
  const Name = cap(e.name);
  const base = e.access === "employee" ? `/admin/${e.plural}` : `/${e.plural}`;
  const choices = e.fields.filter((f) => f.type === "choice");
  const names = e.fields.map((f) => f.name);
  const columns = e.fields.map((f) =>
    snake(f.name) === f.name ? f.name : `${snake(f.name)} as "${f.name}"`,
  );
  const required = e.fields.filter((f) => f.required);
  const valid = Object.fromEntries(required.map((f) => [f.name, sample(f)]));
  const invalid = Object.fromEntries(
    required.slice(1).map((f) => [f.name, sample(f)]),
  );

  const entityModule = `${header(e)}
import { z } from "zod";
import { query } from "@/lib/db";

/** Who may reach ${e.plural}; the page and the route sit where the access says. */
export const ${e.name}Access = "${e.access}" as const;
${choices.map((f) => `export const ${e.name}${cap(f.name)} = ${JSON.stringify(f.options)} as const;`).join("\n")}

export const New${Name} = z.object({
${e.fields.map((f) => `  ${f.name}: ${zodType(e, f)},`).join("\n")}
});
export type New${Name} = z.infer<typeof New${Name}>;

export const ${Name} = New${Name}.extend({ id: z.uuid(), createdAt: z.date() });
export type ${Name} = z.infer<typeof ${Name}>;

const columns = \`id, ${columns.join(", ")}, created_at as "createdAt"\`;

export const list${cap(e.plural)} = () =>
  query<${Name}>(\`select \${columns} from ${e.plural} order by created_at desc\`);

export async function create${Name}(input: New${Name}): Promise<${Name}> {
  const [row] = await query<${Name}>(
    \`insert into ${e.plural} (${e.fields.map((f) => snake(f.name)).join(", ")}) values (${names.map((_, i) => `$${i + 1}`).join(", ")}) returning \${columns}\`,
    [${names.map((n) => `input.${n}`).join(", ")}],
  );
  return row;
}
`;

  const types = `${header(e)}
import { z } from "zod";
import { ${Name}, New${Name} } from "@/lib/entities/${e.name}";

export { New${Name} as ${Name}Body };

export const ${Name}Response = ${Name}.extend({ createdAt: z.iso.datetime() });
export type ${Name}Response = z.infer<typeof ${Name}Response>;
`;

  const route = `${header(e)}
import { z } from "zod";
import { create${Name}, list${cap(e.plural)} } from "@/lib/entities/${e.name}";
import { ${Name}Body } from "./types";

export async function GET() {
  return Response.json(await list${cap(e.plural)}());
}

export async function POST(request: Request) {
  const parsed = ${Name}Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  return Response.json(await create${Name}(parsed.data), { status: 201 });
}
`;

  const test = `${header(e)}
import { expect, test } from "vitest";
import { GET, POST } from "./route";
import { ${Name}Response } from "./types";

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/${e.plural}", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

test("creates a ${e.name} from its required fields and lists it", async () => {
  const response = await post(${JSON.stringify(valid)});
  expect(response.status).toBe(201);
  const created = ${Name}Response.parse(await response.json());
  expect(created).toMatchObject(${JSON.stringify(valid)});
  const listed = ${Name}Response.array().parse(await (await GET()).json());
  expect(listed.map((row) => row.id)).toContain(created.id);
});

test("a ${e.name} without ${label(required[0]).toLowerCase()} is refused with the field named", async () => {
  const response = await post(${JSON.stringify(invalid)});
  expect(response.status).toBe(400);
  const { error } = await response.json();
  expect(Object.keys(error.fieldErrors)).toContain("${required[0].name}");
});
`;

  const actions = `"use server";

${header(e)}
import { refresh } from "next/cache";
import { New${Name}, create${Name} } from "@/lib/entities/${e.name}";

/** A ${e.name} from the form; an empty field is left to its default. */
export async function create${Name}Action(form: FormData) {
  const parsed = New${Name}.safeParse(
    Object.fromEntries([...form.entries()].filter(([, value]) => value !== "")),
  );
  if (!parsed.success) return;
  await create${Name}(parsed.data);
  refresh();
}
`;

  const page = `${header(e)}
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
${choices.length ? 'import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";\n' : ""}import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
${e.fields.some((f) => f.multiline) ? 'import { Textarea } from "@/components/ui/textarea";\n' : ""}import { when } from "@/lib/format";
import { list${cap(e.plural)}${choices.map((f) => `, ${e.name}${cap(f.name)}`).join("")} } from "@/lib/entities/${e.name}";
import { create${Name}Action } from "./actions";

export const metadata: Metadata = { title: "${cap(e.plural)}" };

export default function ${cap(e.plural)}Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">${cap(e.plural)}</h1>
      <form action={create${Name}Action} className="mt-6 grid gap-4 sm:grid-cols-2">
      ${e.fields.map((f) => input(e, f)).join("\n      ")}
        <div className="sm:col-span-2">
          <PendingButton busy="Saving…" icon={<Plus />}>
            Add ${e.name}
          </PendingButton>
        </div>
      </form>
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <${cap(e.plural)} />
      </Suspense>
    </>
  );
}

async function ${cap(e.plural)}() {
  await io();
  const rows = await list${cap(e.plural)}();
  const now = new Date();
  return (
    <div className="mt-8 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
${e.fields.map((f) => `            <TableHead>${label(f)}</TableHead>`).join("\n")}
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={${e.fields.length + 1}} className="text-center text-muted-foreground">
                No ${e.plural} yet
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
${e.fields.map((f) => `              <TableCell className="max-w-xs whitespace-normal">{row.${f.name}${f.required || f.type === "choice" ? "" : ' ?? "–"'}}</TableCell>`).join("\n")}
              <TableCell className="text-muted-foreground">{when(row.createdAt, now)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
`;

  return [
    { path: `src/lib/entities/${e.name}.ts`, source: entityModule },
    { path: `src/app/api/${e.plural}/types.ts`, source: types },
    { path: `src/app/api/${e.plural}/route.ts`, source: route },
    { path: `src/app/api/${e.plural}/route.test.ts`, source: test },
    { path: `src/app${base}/actions.ts`, source: actions },
    { path: `src/app${base}/page.tsx`, source: page },
  ];
}

/** The statement that creates an entity's table, from its fields. */
export const table = (e: Entity) => `create table if not exists ${e.plural} (
  id uuid primary key default gen_random_uuid(),
  ${e.fields.map(column).join(",\n  ")},
  created_at timestamptz not null default now()
)`;

/** What the hand-written code imports: the tables for the schema, in a file that imports nothing, and the pages for the navigation. */
export function index(entities: Entity[]): Generated[] {
  const tables = {
    path: "src/lib/entities/tables.ts",
    source: `// Generated from content/entities by pnpm generate. Edit a description, not this file.
// The schema spreads these; nothing is imported here, so the schema never waits on a module that needs the database.
export const entityTables = [
${entities.map((e) => `  \`${table(e)}\`,`).join("\n")}
];
`,
  };
  const pages = {
    path: "src/lib/entities/index.ts",
    source: `// Generated from content/entities by pnpm generate. Edit a description, not this file.
export const entityPages = [
${entities
  .map(
    (e) =>
      `  { href: "${e.access === "employee" ? `/admin/${e.plural}` : `/${e.plural}`}", label: "${cap(e.plural)}", access: "${e.access}" as const },`,
  )
  .join("\n")}
];
`,
  };
  return [tables, pages];
}
