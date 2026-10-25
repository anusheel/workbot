import type { ReactNode } from "react";
import { type Role, currentUser, permits, requireUser } from "@/lib/auth";

/** What a role reaches, shown only to it: the action behind the control checks the role again. Sits inside a Suspense boundary, since it reads the session. */
export async function Allowed({
  role,
  fallback = null,
  children,
}: {
  role: Role;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const user = await currentUser();
  return user && permits(user.role, role) ? children : fallback;
}

/** A page's content for a signed-in user, checked here rather than trusted from the proxy, which only sees that a cookie is present; anyone else is sent to sign in. */
export async function SignedIn({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
