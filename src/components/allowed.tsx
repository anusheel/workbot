import type { ReactNode } from "react";
import { type Role, currentUser, permits } from "@/lib/auth";

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
