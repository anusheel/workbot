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
