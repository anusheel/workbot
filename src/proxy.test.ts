import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { proxy } from "./proxy";

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "http://workbot"), { headers });

test("an employee page without a session goes to sign in, and comes back after", () => {
  const response = proxy(request("/admin/tickets"));
  expect(response?.status).toBe(307);
  expect(response?.headers.get("location")).toBe(
    "http://workbot/sign-in?next=%2Fadmin%2Ftickets",
  );
});

test("an employee API without a session or a key is a 401, and with either goes on", () => {
  expect(proxy(request("/api/requests"))?.status).toBe(401);
  expect(proxy(request("/api/admin/vendors"))?.status).toBe(401);
  expect(
    proxy(request("/api/requests", { authorization: "Bearer wb_x" })),
  ).toBeUndefined();
  expect(
    proxy(request("/api/requests", { cookie: "session=ws_x" })),
  ).toBeUndefined();
});

test("public pages and APIs pass, and a page gives a first-time visitor an anonymous id", () => {
  expect(proxy(request("/api/chat"))).toBeUndefined();
  expect(proxy(request("/chat"))?.headers.get("set-cookie")).toMatch(
    /^visitor=/,
  );
  expect(proxy(request("/chat", { cookie: "visitor=v1" }))).toBeUndefined();
  // A path that only starts like an employee one is not one.
  expect(
    proxy(request("/administrators", { cookie: "visitor=v1" })),
  ).toBeUndefined();
});
