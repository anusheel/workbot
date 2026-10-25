import { io } from "next/cache";
import { z } from "zod";
import { query } from "./db";
import { customer } from "./customer";
import {
  type Priority,
  type Status,
  type Team,
  priorities,
  requestModel,
  statuses,
} from "./request-model";

export * from "./request-model";

/** The customer's teams, from its configuration, and the request schemas built on them. */
export const teams = customer.teams.map((t) => t.id) as [string, ...string[]];
export const { NewRequest, RequestFilter, WorkRequest } = requestModel(teams);
export type NewRequest = z.infer<typeof NewRequest>;
export type RequestFilter = z.infer<typeof RequestFilter>;
export type WorkRequest = z.infer<typeof WorkRequest>;

const columns = `id, title, body, team, priority, status, created_at as "createdAt"`;

export async function createRequest(input: NewRequest): Promise<WorkRequest> {
  const [row] = await query(
    `insert into requests (title, body, team, priority) values ($1, $2, $3, $4) returning ${columns}`,
    [input.title, input.body, input.team, input.priority],
  );
  return WorkRequest.parse(row);
}

export async function listRequests(
  filter: RequestFilter = {},
): Promise<WorkRequest[]> {
  await io();
  const rows = await query(
    `select ${columns} from requests
     where ($1::text is null or team = $1) and ($2::text is null or status = $2)
     order by created_at desc`,
    [filter.team ?? null, filter.status ?? null],
  );
  return WorkRequest.array().parse(rows);
}

export async function getRequest(id: string): Promise<WorkRequest | undefined> {
  await io();
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await query(`select ${columns} from requests where id = $1`, [
    id,
  ]);
  return row && WorkRequest.parse(row);
}

export async function updateRequest(
  id: string,
  patch: Pick<WorkRequest, "status">,
): Promise<WorkRequest | undefined> {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await query(
    `update requests set status = $2 where id = $1 returning ${columns}`,
    [id, patch.status],
  );
  return row && WorkRequest.parse(row);
}

export type RequestSummary = {
  total: number;
  byStatus: Record<Status, number>;
  byTeam: Record<Team, number>;
  byPriority: Record<Priority, number>;
  latest: WorkRequest[];
};

/** The numbers a dashboard is built from: counts by status, team and priority, and the 10 latest requests. */
export async function requestSummary(): Promise<RequestSummary> {
  type Tally = {
    team: Team;
    status: Status;
    priority: Priority;
    count: number;
  };
  const rows = await query<Tally>(
    `select team, status, priority, count(*)::int as count from requests group by 1, 2, 3`,
  );
  const sum = (rows: Tally[]) => rows.reduce((n, r) => n + r.count, 0);
  const by = <K extends string>(keys: readonly K[], of: (row: Tally) => K) =>
    Object.fromEntries(
      keys.map((key) => [key, sum(rows.filter((row) => of(row) === key))]),
    ) as Record<K, number>;
  return {
    total: sum(rows),
    byStatus: by(statuses, (r) => r.status),
    byTeam: by(teams, (r) => r.team),
    byPriority: by(priorities, (r) => r.priority),
    latest: (await listRequests()).slice(0, 10),
  };
}
