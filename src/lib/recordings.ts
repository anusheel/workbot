import { io } from "next/cache";
import { query } from "./db";
import type { Scene } from "./video";

export type Recording = {
  id: string;
  requestId: string;
  name: string;
  seconds: number;
  scenes: Scene[];
  summary: string;
  createdAt: Date;
};

const columns = `id, request_id as "requestId", name, seconds, scenes, summary, created_at as "createdAt"`;

/** Files a recording's timeline on a request, with what each frame showed for later questions. */
export async function saveRecording(
  requestId: string,
  recording: Pick<Recording, "name" | "seconds" | "scenes" | "summary">,
): Promise<Recording> {
  const [row] = await query<Recording>(
    `insert into recordings (request_id, name, seconds, scenes, summary) values ($1, $2, $3, $4, $5) returning ${columns}`,
    [
      requestId,
      recording.name,
      recording.seconds,
      recording.scenes,
      recording.summary,
    ],
  );
  return row;
}

export async function listRecordings(requestId: string): Promise<Recording[]> {
  await io();
  return query<Recording>(
    `select ${columns} from recordings where request_id = $1 order by created_at`,
    [requestId],
  );
}

export async function getRecording(id: string): Promise<Recording | undefined> {
  const [row] = await query<Recording>(
    `select ${columns} from recordings where id = $1`,
    [id],
  );
  return row;
}
