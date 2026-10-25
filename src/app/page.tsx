import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const teams = [
  {
    name: "Operations",
    does: "Answers policy questions and files requests from any channel.",
  },
  {
    name: "Finance",
    does: "Explains invoices and expense rules, and tracks what needs approval.",
  },
  {
    name: "Support",
    does: "Drafts replies from the knowledge base, with sources, for a person to send.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-24">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          An assistant for the teams that keep a company running
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          WorkBot answers questions, files requests and runs workflows for
          operations, finance and support teams, and for the customers they
          serve.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/chat">
              Ask WorkBot <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/requests/new">File a request</Link>
          </Button>
        </div>
      </section>
      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.name}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>{team.does}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
