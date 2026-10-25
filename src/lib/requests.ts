import { io } from "next/cache";
import { z } from "zod";

export const teams = ["operations", "finance", "support"] as const;
export const priorities = ["low", "normal", "high"] as const;
export const statuses = ["open", "in_progress", "done"] as const;
export type Status = (typeof statuses)[number];

export const statusLabels: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export const NewRequest = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(5000).default(""),
  team: z.enum(teams),
  priority: z.enum(priorities).default("normal"),
});
export type NewRequest = z.infer<typeof NewRequest>;

export type WorkRequest = NewRequest & {
  id: string;
  status: Status;
  createdAt: Date;
};

// In memory until the database arrives (WB-17), newest first. Each route is
// bundled on its own, so module state would be per route; the server process
// shares one list through globalThis.
type Store = typeof globalThis & { requests?: WorkRequest[] };
const requests = ((globalThis as Store).requests ??= []);

export async function createRequest(input: NewRequest): Promise<WorkRequest> {
  const request = {
    ...input,
    id: crypto.randomUUID(),
    status: "open" as const,
    createdAt: new Date(),
  };
  requests.unshift(request);
  return request;
}

export async function listRequests(): Promise<WorkRequest[]> {
  await io();
  return requests;
}

export async function getRequest(id: string): Promise<WorkRequest | undefined> {
  await io();
  return requests.find((r) => r.id === id);
}

export async function updateRequest(
  id: string,
  patch: Partial<Pick<WorkRequest, "status">>,
) {
  const request = requests.find((r) => r.id === id);
  if (request) Object.assign(request, patch);
  return request;
}
