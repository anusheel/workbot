import Link from "next/link";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/requests", label: "Requests" },
  { href: "/policies", label: "Policies" },
  { href: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          WorkBot
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Button key={href} asChild variant="ghost" size="sm">
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
