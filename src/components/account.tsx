import Link from "next/link";
import { signOut } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth";

/** Who is signed in, and the way out; or the way in. */
export async function Account() {
  const user = await currentUser();
  if (!user)
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {user.name} · {user.role}
      </span>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
