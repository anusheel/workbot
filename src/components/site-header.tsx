import Link from "next/link";
import { Suspense } from "react";
import { Account } from "@/components/account";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { customer } from "@/lib/customer";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/requests", label: "Requests" },
  { href: "/voice", label: "Voice" },
  { href: "/policies", label: "Policies" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/admin", label: "Admin" },
  { href: "/settings", label: "Settings" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {customer.assistant}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Button key={href} asChild variant="ghost" size="sm">
              <NavLink href={href}>{label}</NavLink>
            </Button>
          ))}
          <span className="ml-3">
            <Suspense>
              <Account />
            </Suspense>
          </span>
        </nav>
      </div>
    </header>
  );
}
