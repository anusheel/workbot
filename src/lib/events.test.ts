import { expect, test } from "vitest";
import { listDeadLetters } from "./dead-letters";
import { query } from "./db";
import { consumerLag, dispatch } from "./events";
import { createRequest } from "./requests";

const notificationsFor = (title: string) =>
  query(`select id from notifications where message = $1`, [
    `New request: ${title}`,
  ]);

test("a request and its event are written together, and each consumer reads it once", async () => {
  const request = await createRequest({
    title: "Forklift 3 hydraulic leak",
    body: "",
    team: "operations",
    priority: "high",
  });
  const [event] = await query<{
    topic: string;
    version: number;
    data: unknown;
  }>(`select topic, version, data from events where key = $1`, [request.id]);
  expect(event).toEqual({
    topic: "request.created",
    version: 1,
    data: {
      id: request.id,
      title: "Forklift 3 hydraulic leak",
      team: "operations",
      priority: "high",
    },
  });

  expect(await dispatch()).toEqual({ notifications: 1, analytics: 1 });
  expect(await dispatch()).toEqual({ notifications: 0, analytics: 0 });
  expect(await notificationsFor("Forklift 3 hydraulic leak")).toHaveLength(1);

  // Read again from the start, as after a lost position: the notification is not made twice.
  await query(`update event_offsets set position = 0`);
  await dispatch();
  expect(await notificationsFor("Forklift 3 hydraulic leak")).toHaveLength(1);
});

test("a field a consumer does not know passes; a version it cannot read is dead-lettered on the third pass, and the next event goes through", async () => {
  await query(
    `insert into events (topic, version, key, data) values
       ('request.created', 1, 'r-new-field', '{"id": "r-new-field", "title": "Extra field", "team": "finance", "priority": "low", "source": "api"}'),
       ('request.created', 2, 'r-v2', '{"id": "r-v2", "summary": "a shape no consumer reads yet"}'),
       ('request.created', 1, 'r-after', '{"id": "r-after", "title": "After the bad one", "team": "support", "priority": "normal"}')`,
  );
  await dispatch();
  expect(await notificationsFor("Extra field")).toHaveLength(1);
  expect(await notificationsFor("After the bad one")).toHaveLength(0);
  expect(
    (await consumerLag()).find((c) => c.name === "notifications"),
  ).toMatchObject({
    behind: 2,
    failures: 1,
  });

  await dispatch();
  await dispatch();
  expect(await notificationsFor("After the bad one")).toHaveLength(1);
  const letters = await listDeadLetters();
  expect(letters.map((l) => [l.source, l.owner, l.attempts, l.error])).toEqual(
    expect.arrayContaining([
      [
        "event:notifications",
        "r-v2",
        3,
        "No reader for request.created version 2",
      ],
      ["event:analytics", "r-v2", 3, "No reader for request.created version 2"],
    ]),
  );
  expect((await consumerLag()).every((c) => c.behind === 0)).toBe(true);
});

test("an event that fails, then goes through, does not use up the next event's tries", async () => {
  await query(
    `update event_offsets set position = (select max(id) from events)`,
  );
  const inserted = await query<{ id: string; key: string }>(
    `insert into events (topic, version, key, data) values
       ('request.created', 1, 'r-flaky', '{"id": "r-flaky"}'),
       ('request.created', 2, 'r-next', '{"id": "r-next"}')
     returning id::text, key`,
  );
  const { id } = inserted.find((event) => event.key === "r-flaky")!;
  await dispatch();
  await dispatch();
  // The cause is fixed before the third try: the event goes through, and the next one fails for the first time.
  await query(
    `update events set data = '{"id": "r-flaky", "title": "Flaky", "team": "support", "priority": "low"}' where id = $1`,
    [id],
  );
  await dispatch();
  expect(await notificationsFor("Flaky")).toHaveLength(1);
  expect((await listDeadLetters()).filter((l) => l.owner === "r-next")).toEqual(
    [],
  );
  expect(
    (await consumerLag()).find((c) => c.name === "notifications"),
  ).toMatchObject({
    behind: 1,
    failures: 1,
  });
});
