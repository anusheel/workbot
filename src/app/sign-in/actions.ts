"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  endSession,
  returnPath,
  sessionCookie,
  startSession,
} from "@/lib/auth";
import { config } from "@/lib/config";

// Where the cookie is sent: the app's pages, and the realtime server's when they share a domain.
const scope = { path: "/", domain: config.cookieDomain };

export async function signIn(_: string | undefined, form: FormData) {
  const key = String(form.get("key") ?? "").trim();
  const session = key ? await startSession(key) : undefined;
  if (!session) return "That key is not valid, or it was revoked.";
  (await cookies()).set(sessionCookie, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...scope,
    maxAge: session.maxAge,
  });
  redirect(returnPath(form.get("next")));
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await endSession(token);
  jar.delete({ name: sessionCookie, ...scope });
  redirect("/");
}
