import { query } from "./db";

export type Note = { id: string; text: string; createdAt: Date };

const columns = `id, text, created_at as "createdAt"`;

export async function saveNote(text: string): Promise<Note> {
  const [note] = await query<Note>(
    `insert into notes (text) values ($1) returning ${columns}`,
    [text],
  );
  return note;
}

export async function listNotes(): Promise<Note[]> {
  return query<Note>(`select ${columns} from notes order by created_at desc`);
}
