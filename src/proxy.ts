import { NextResponse, type NextRequest } from "next/server";

// What only employees reach. The check here is optimistic, a session
// cookie or a key is present; the page, action or route checks who it is.
const pages = ["/admin", "/requests", "/dashboards"];
const apis = [
  "/api/admin",
  "/api/requests",
  "/api/documents",
  "/api/generate",
  "/api/intake",
];
const under = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const credentials =
    request.cookies.has("session") ||
    request.headers.get("authorization")?.startsWith("Bearer ");
  if (!credentials && apis.some((prefix) => under(path, prefix)))
    return Response.json(
      { error: "Sign in, or send a key as a bearer token" },
      { status: 401 },
    );
  if (!credentials && pages.some((prefix) => under(path, prefix))) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", path);
    return NextResponse.redirect(signIn);
  }
  if (path.startsWith("/api/") || request.cookies.has("visitor")) return;
  // Every visitor gets an anonymous id, so analytics can follow one person
  // through the intake funnel without knowing who they are.
  const response = NextResponse.next();
  response.cookies.set("visitor", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = { matcher: "/((?!_next|favicon.ico).*)" };
