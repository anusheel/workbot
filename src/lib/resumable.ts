import { query } from "./db";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps a reply's stream as it goes out, in parts of about a tenth of a
 * second, so a reader who lost it (a reload, a dropped connection) can read
 * it again. The stream is marked done when it ends, however it ends.
 */
export async function record(
  id: string,
  conversation: string,
  person: string,
  stream: ReadableStream<string>,
) {
  await query(
    `insert into streams (id, conversation_id, person) values ($1, $2, $3)`,
    [id, conversation, person],
  );
  let seq = 0;
  let pending = "";
  let flushed = Date.now();
  const flush = async () => {
    if (!pending) return;
    await query(
      `insert into stream_parts (stream_id, seq, data) values ($1, $2, $3)`,
      [id, seq++, pending],
    );
    pending = "";
    flushed = Date.now();
  };
  try {
    const reader = stream.getReader();
    for (
      let read = await reader.read();
      !read.done;
      read = await reader.read()
    ) {
      pending += read.value;
      if (Date.now() - flushed >= 100) await flush();
    }
    await flush();
  } finally {
    await query(`update streams set done = true where id = $1`, [id]);
  }
}

/**
 * The conversation's unfinished reply, for its person: every part written so
 * far, then each new one as it is written, until the reply is done or a
 * minute has passed. Nothing when no reply is under way.
 */
export async function resume(
  conversation: string,
  person: string,
  { poll = 200, limit = 60_000 } = {},
): Promise<ReadableStream<string> | undefined> {
  const [stream] = await query<{ id: string }>(
    `select id from streams where conversation_id = $1 and person = $2 and not done order by created_at desc limit 1`,
    [conversation, person],
  );
  if (!stream) return undefined;
  const until = Date.now() + limit;
  let next = 0;
  return new ReadableStream<string>({
    async pull(controller) {
      while (Date.now() < until) {
        // Done is read first: the last part is written before the stream is marked done, so it cannot be missed.
        const [{ done }] = await query<{ done: boolean }>(
          `select done from streams where id = $1`,
          [stream.id],
        );
        const parts = await query<{ seq: number; data: string }>(
          `select seq, data from stream_parts where stream_id = $1 and seq >= $2 order by seq`,
          [stream.id, next],
        );
        if (parts.length) {
          for (const part of parts) controller.enqueue(part.data);
          next = parts.at(-1)!.seq + 1;
          return;
        }
        if (done) break;
        await pause(poll);
      }
      controller.close();
    },
  });
}
