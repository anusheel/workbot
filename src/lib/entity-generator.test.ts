import { expect, test } from "vitest";
import { generate, index, table } from "./entity-generator";
import { Entity } from "./entity-model";

const vendor = Entity.parse({
  name: "vendor",
  plural: "vendors",
  label: "Vendor",
  fields: [
    { name: "name", type: "text", required: true, max: 120 },
    { name: "email", type: "email" },
    {
      name: "terms",
      type: "choice",
      options: ["net 15", "net 30"],
      default: "net 30",
    },
    { name: "notes", type: "text", max: 2000, multiline: true },
  ],
});

test("a description becomes its module, route, types, test, action and page, under the access it names", () => {
  expect(generate(vendor).map((f) => f.path)).toEqual([
    "src/lib/entities/vendor.ts",
    "src/app/api/vendors/types.ts",
    "src/app/api/vendors/route.ts",
    "src/app/api/vendors/route.test.ts",
    "src/app/admin/vendors/actions.ts",
    "src/app/admin/vendors/page.tsx",
  ]);
  expect(generate({ ...vendor, access: "customer" }).at(-1)?.path).toBe(
    "src/app/vendors/page.tsx",
  );
});

test("a required field is not null, a choice carries its default, optional text defaults to empty", () => {
  const statement = table(vendor);
  expect(statement).toContain("name text not null,");
  expect(statement).toContain("email text,");
  expect(statement).toContain("terms text not null default 'net 30',");
  expect(statement).toContain("notes text not null default '',");
  const [{ source }] = generate(vendor);
  expect(source).toContain('terms: z.enum(vendorTerms).default("net 30"),');
  expect(source).toContain("email: z.email().nullable().default(null),");
});

test("the generated test sends the required fields and leaves the first one out to be refused", () => {
  const source = generate(vendor).find((f) =>
    f.path.endsWith("route.test.ts"),
  )!.source;
  expect(source).toContain('post({"name":"Sample name"})');
  expect(source).toContain(
    'expect(Object.keys(error.fieldErrors)).toContain("name");',
  );
});

test("the index lists every table for the schema, in a file that imports nothing, and every page for the navigation", () => {
  const [tables, pages] = index([
    vendor,
    {
      ...vendor,
      name: "site",
      plural: "sites",
      label: "Site",
      access: "customer",
    },
  ]);
  expect(tables.path).toBe("src/lib/entities/tables.ts");
  expect(tables.source).not.toContain("import ");
  expect(tables.source).toContain("create table if not exists vendors");
  expect(tables.source).toContain("create table if not exists sites");
  expect(pages.source).toContain(
    '{ href: "/admin/vendors", label: "Vendors", access: "employee" as const },',
  );
  expect(pages.source).toContain(
    '{ href: "/sites", label: "Sites", access: "customer" as const },',
  );
});

test("a description without a required field, with a repeated field or with a bad choice default is refused", () => {
  const field = { name: "name", type: "text", required: true };
  expect(() =>
    Entity.parse({ ...vendor, fields: [{ name: "x", type: "text" }] }),
  ).toThrow(/required field/);
  expect(() => Entity.parse({ ...vendor, fields: [field, field] })).toThrow(
    /repeat/,
  );
  expect(() =>
    Entity.parse({
      ...vendor,
      fields: [
        field,
        { name: "kind", type: "choice", options: ["a"], default: "b" },
      ],
    }),
  ).toThrow(/one of its options/);
});
