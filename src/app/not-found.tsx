import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-sm text-muted-foreground">
        There is nothing at this address.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Home</Link>
      </Button>
    </main>
  );
}
