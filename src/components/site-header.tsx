import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";

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
          WorkBot
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Button key={href} asChild variant="ghost" size="sm">
              <NavLink href={href}>{label}</NavLink>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
