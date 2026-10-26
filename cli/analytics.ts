import { analyst, failingTests, report, withAnalytics } from "@/lib/analysis";
import { modelFor } from "@/lib/routing";
import { asOperator } from "@/lib/tracing";

// The analytics from the terminal: the weekly report, the data tests, a
// question for the analyst, or the analyst checked on questions whose answers
// are known from SQL written by hand.
// Usage: pnpm analytics report | test | ask "<question>" | check
const [command, ...words] = process.argv.slice(2);

if (command === "report") {
  for (const m of await report()) {
    console.log(`\n## ${m.title}\n${m.result.columns.join("\t")}`);
    for (const row of m.result.rows) console.log(row.join("\t"));
  }
  // The analyst's summary heads the report; a person reads both before it goes out.
  const { answer, dollars } = await asOperator("analyst", () =>
    analyst(
      "Write this week's usage report in four sentences: active people this week and last, retention of the newest full cohorts, what people use WorkBot for, and spend per person. Figures only from queries.",
      modelFor("chat"),
    ),
  );
  console.log(`\n## Summary, for review\n${answer}\n($${dollars.toFixed(4)})`);
} else if (command === "test") {
  const failing = await failingTests();
  console.log(
    failing.length
      ? `failing: ${failing.join(", ")}`
      : "every data test passes",
  );
  process.exitCode = failing.length ? 1 : 0;
} else if (command === "ask") {
  const { answer, queries, dollars } = await asOperator("analyst", () =>
    analyst(words.join(" "), modelFor("chat")),
  );
  for (const q of queries) console.log(`> ${q.sql}`);
  console.log(`\n${answer}\n($${dollars.toFixed(4)})`);
} else if (command === "check") {
  const known = [
    {
      question: "How many people have joined in total?",
      sql: "select count(*) from people",
    },
    {
      question: "How many chat uses were there in September 2026?",
      sql: "select count(*) from activity where kind = 'chat' and day between '2026-09-01' and '2026-09-30'",
    },
    {
      question:
        "How much did Harbor Dental's activity cost in total, in dollars, to two decimal places?",
      sql: "select round(sum(dollars), 2) from activity where tenant = 'harbor-dental'",
    },
  ];
  for (const { question, sql } of known) {
    const [[expected]] = (await withAnalytics((db) => db.query(sql))).rows;
    const { answer, queries } = await asOperator("analyst", () =>
      analyst(question, modelFor("chat")),
    );
    const matches = answer.replaceAll(",", "").includes(String(expected));
    console.log(
      `${matches ? "match" : "MISMATCH"}  ${question}\n  expected ${expected}; answered: ${answer}\n  sql: ${queries.at(-1)?.sql}`,
    );
    if (!matches) process.exitCode = 1;
  }
}
