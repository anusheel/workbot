const time = (at: Date) =>
  at.toLocaleTimeString("en-GB", { timeStyle: "medium" });

export function when(at: Date, now: Date = new Date()): string {
  if (at.toDateString() === now.toDateString()) return time(at);
  const day = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time(at)}`;
}

/** A span of seconds in the largest unit that reads: 4 s, 7 min, 2 h, 3 d. */
export function span(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} d`;
}
