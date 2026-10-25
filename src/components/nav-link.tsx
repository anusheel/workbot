"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  // For a link whose path is also the parent of its siblings, such as /admin.
  exact?: boolean;
};

function CurrentLink({ href, exact, ...props }: Props) {
  const pathname = usePathname();
  const current =
    pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={current ? "page" : undefined} {...props} />
  );
}

// The pathname of a route with a dynamic segment is only known at request
// time, so the layouts that hold the navs would suspend without a boundary.
export function NavLink({ exact, ...props }: Props) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <CurrentLink exact={exact} {...props} />
    </Suspense>
  );
}
