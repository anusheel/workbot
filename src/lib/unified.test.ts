import { expect, test } from "vitest";
import {
  findContacts,
  findTickets,
  fromDocument,
  fromIssue,
  fromRequest,
  upsertContact,
  upsertTicket,
} from "./unified";

const at = new Date("2026-10-20T08:00:00Z");

test("an issue as the server lists it and as a webhook delivers it become the same ticket", () => {
  const listed = fromIssue("acme/helpdesk", {
    number: 7,
    title: "Van 3 brake light",
    body: "",
    state: "OPEN",
    assignees: [{ login: "sam" }],
    labels: ["fleet"],
    updated_at: "2026-10-20T08:00:00Z",
  });
  const delivered = fromIssue("acme/helpdesk", {
    number: 7,
    title: "Van 3 brake light",
    body: null,
    state: "open",
    assignees: [{ login: "sam" }],
    labels: [{ name: "fleet" }],
    html_url: "https://github.com/acme/helpdesk/issues/7",
    updated_at: "2026-10-20T08:00:00Z",
  });
  const { raw: _a, ...a } = listed;
  const { raw: _b, ...b } = delivered;
  expect(a).toEqual(b);
  expect(a).toMatchObject({
    source: "github",
    key: "7",
    state: "open",
    assignee: "sam",
    labels: ["fleet"],
    url: "https://github.com/acme/helpdesk/issues/7",
  });
});

test("a request becomes a ticket under its own source, with its team already set", () => {
  const ticket = fromRequest({
    id: "3f4c2a0e-5b1d-4f8a-9c6e-1d2e3f4a5b6c",
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "high",
    status: "open",
    createdAt: at,
  });
  expect(ticket).toMatchObject({
    source: "workbot",
    key: "3f4c2a0e-5b1d-4f8a-9c6e-1d2e3f4a5b6c",
    team: "operations",
    labels: ["high"],
    url: "/requests/3f4c2a0e-5b1d-4f8a-9c6e-1d2e3f4a5b6c",
  });
});

const document = (type: string, data: unknown) =>
  ({
    id: "d1",
    requestId: "r1",
    type,
    name: "x",
    data,
    confidence: {},
    review: [],
    createdAt: at,
  }) as never;

test("a document's sender becomes a contact keyed by email", () => {
  expect(
    fromDocument(
      document("email", {
        from: "Dana Whitfield <Dana.Whitfield@brightline-retail.example>",
      }),
    ),
  ).toMatchObject({
    source: "document",
    key: "dana.whitfield@brightline-retail.example",
    name: "Dana Whitfield",
    email: "dana.whitfield@brightline-retail.example",
  });
  expect(
    fromDocument(
      document("invoice", {
        vendor: "Tamarack Fleet",
        vendorEmail: "billing@tamarackfleet.example",
        vendorPhone: "(503) 555-0142",
      }),
    ),
  ).toMatchObject({ company: "Tamarack Fleet", phone: "(503) 555-0142" });
  expect(
    fromDocument(
      document("letter", {
        from: "R. Okafor",
        fields: [
          { name: "Phone", value: "503-555-0199" },
          { name: "E-mail", value: "rokafor@example.com" },
        ],
      }),
    ),
  ).toMatchObject({ key: "rokafor@example.com", phone: "503-555-0199" });
  expect(fromDocument(document("job", { title: "Driver" }))).toBeUndefined();
});

test("a contact seen twice is one row that keeps what it knew, found by its phone in any form", async () => {
  const seen = (phone: string | null, when: Date) =>
    upsertContact({
      source: "document",
      key: "billing@tamarackfleet.example",
      name: "Tamarack Fleet",
      email: "billing@tamarackfleet.example",
      phone,
      company: null,
      url: null,
      updatedAt: when,
      raw: {},
    });
  const first = await seen("(503) 555-0142", at);
  expect(first).toMatchObject({
    phone: "+15035550142",
    company: "Tamarackfleet",
  });
  expect(first.applied.map((a) => a.rule)).toEqual([
    "phone-e164",
    "company-from-domain",
  ]);
  const again = await seen(null, new Date("2026-10-21T08:00:00Z"));
  expect(again.phone).toBe("+15035550142");
  expect(await findContacts("503 555 0142")).toHaveLength(1);
  expect(await findContacts("tamarack")).toHaveLength(1);
  expect(await findContacts("+1 (503) 555-0199")).toHaveLength(0);
});

test("a stored ticket carries the team the rules gave it", async () => {
  const ticket = await upsertTicket(
    fromIssue("acme/helpdesk", {
      number: 9,
      title: "Invoice 4471 unpaid",
      state: "OPEN",
      updated_at: "2026-10-20T08:00:00Z",
    }),
  );
  expect(ticket.team).toBe("finance");
  expect(ticket.applied).toEqual([
    { rule: "route-finance", field: "team", from: null, to: "finance" },
  ]);
  expect((await findTickets("4471"))[0].id).toBe("github#9");
});

test("a version older than the row's is dropped, so a late delivery never undoes a pull", async () => {
  const version = (title: string, at: string) =>
    upsertTicket(
      fromIssue("acme/helpdesk", {
        number: 10,
        title,
        state: "OPEN",
        updated_at: at,
      }),
    );
  await version("Dock door stuck", "2026-10-20T09:00:00Z");
  const late = await version("Dock door", "2026-10-20T08:00:00Z");
  expect(late.title).toBe("Dock door stuck");
  expect((await findTickets("dock door")).map((t) => t.title)).toEqual([
    "Dock door stuck",
  ]);
});
