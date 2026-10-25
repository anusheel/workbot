/**
 * Who may do what. A person or a service is a user with a role: a viewer
 * reads, an agent also acts, an admin also administers. The public, signed
 * in as no one, sits below all three. Every check compares a role against
 * this ladder, so a role grants everything below it.
 */
export const roles = ["viewer", "agent", "admin"] as const;
export type Role = (typeof roles)[number];
export type Access = "public" | Role;

const ladder: Access[] = ["public", ...roles];
export const permits = (have: Access, need: Access) =>
  ladder.indexOf(have) >= ladder.indexOf(need);

/**
 * Where to go after signing in: a path on this site, never another site.
 * The path is resolved as a browser would, backslashes included, and kept
 * only when it stays on this origin.
 */
export function returnPath(next: unknown, fallback = "/admin") {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  const here = "http://workbot.invalid";
  const url = new URL(next, here);
  return url.origin === here ? url.pathname + url.search : fallback;
}
