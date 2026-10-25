"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, sessionCookie, startSession } from "@/lib/auth";

/** Where to go after signing in: a path on this site, never another site. */
const safe = (next: FormDataEntryValue | null) => {
  const path = typeof next === "string" ? next : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/admin";
};

export async function signIn(_: string | undefined, form: FormData) {
  const key = String(form.get("key") ?? "").trim();
  const session = key ? await startSession(key) : undefined;
  if (!session) return "That key is not valid, or it was revoked.";
  (await cookies()).set(sessionCookie, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  redirect(safe(form.get("next")));
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await endSession(token);
  jar.delete(sessionCookie);
  redirect("/");
}
