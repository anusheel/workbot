import { NextResponse, type NextRequest } from "next/server";

// Every visitor gets an anonymous id, so analytics can follow one person
// through the intake funnel without knowing who they are.
export function proxy(request: NextRequest) {
  if (request.cookies.has("visitor")) return;
  const response = NextResponse.next();
  response.cookies.set("visitor", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = { matcher: "/((?!api|_next|favicon.ico).*)" };
