import Link from "next/link";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/assistant", label: "Assistant" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 gap-12 px-6 py-16">
      <nav className="w-44 shrink-0">
        <p className="px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Admin
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {nav.map(({ href, label }) => (
            <li key={href}>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href={href}>{label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
