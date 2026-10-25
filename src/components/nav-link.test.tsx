import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import AdminLayout from "@/app/admin/layout";
import { ConversationList } from "./conversation-list";
import { NavLink } from "./nav-link";
import { SiteHeader } from "./site-header";

const pathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock("next/navigation", () => ({ usePathname: pathname }));

beforeEach(() => pathname.mockReturnValue("/admin/inbox"));

const admin = <AdminLayout params={Promise.resolve({})}>{null}</AdminLayout>;

// The hrefs of the links marked as the current page, whatever the attribute order.
function current(html: string) {
  return [...html.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes('aria-current="page"'))
    .map((tag) => /href="([^"]*)"/.exec(tag)?.[1]);
}

test("marks the link for the current page and not an exact-match parent", () => {
  const html = renderToStaticMarkup(
    <>
      <NavLink href="/admin" exact>
        Overview
      </NavLink>
      <NavLink href="/admin/inbox" exact>
        Inbox
      </NavLink>
    </>,
  );
  expect(current(html)).toEqual(["/admin/inbox"]);
});

test("marks a section by its path prefix, not by a shared prefix of letters", () => {
  pathname.mockReturnValue("/requests/42");
  const html = renderToStaticMarkup(
    <>
      <NavLink href="/requests">Requests</NavLink>
      <NavLink href="/req">Req</NavLink>
      <NavLink href="/chat">Chat</NavLink>
    </>,
  );
  expect(current(html)).toEqual(["/requests"]);
});

test("marks the section in the main nav and the page in the admin nav", () => {
  expect(current(renderToStaticMarkup(<SiteHeader />))).toEqual(["/admin"]);
  expect(current(renderToStaticMarkup(admin))).toEqual(["/admin/inbox"]);
});

test("labels each nav landmark", () => {
  expect(renderToStaticMarkup(<SiteHeader />)).toContain(
    '<nav aria-label="Main"',
  );
  expect(renderToStaticMarkup(admin)).toContain('<nav aria-label="Admin"');
  expect(
    renderToStaticMarkup(
      <ConversationList
        conversations={[]}
        activeId=""
        onSelect={() => {}}
        onNew={() => {}}
      />,
    ),
  ).toContain('<nav aria-label="Conversations"');
});
