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
