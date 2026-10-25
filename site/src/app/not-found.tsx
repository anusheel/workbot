import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-5xl font-semibold tracking-tight text-balance">
        Page not found
      </h1>
      <p className="text-xl leading-relaxed text-neutral-600">
        There is nothing at this address.
      </p>
      <Link
        href="/"
        className="self-start text-sm font-medium text-neutral-900 underline underline-offset-4"
      >
        Back to the home page
      </Link>
    </main>
  );
}
