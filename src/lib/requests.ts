import { io } from "next/cache";
import { z } from "zod";
import { query } from "./db";
import { NewRequest, RequestFilter, WorkRequest } from "./request-model";

export * from "./request-model";

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
): Promise<void> {
  await query(`update requests set status = $2 where id = $1`, [
    id,
    patch.status,
  ]);
}
