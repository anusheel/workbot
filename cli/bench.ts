import { parseArgs } from "node:util";

// A load test of the API on a running deployment: workers that each create a
// request and then list the requests, as fast as answers come, for a while.
// Usage: BENCH_KEY=<an agent's key> pnpm bench [--url http://localhost:3500] [--workers 20] [--seconds 30]
const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3500" },
    workers: { type: "string", default: "20" },
    seconds: { type: "string", default: "30" },
  },
});
const key = process.env.BENCH_KEY;
if (!key) throw new Error("BENCH_KEY must be an agent's key");
const headers = {
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
};
const seconds = Number(values.seconds);
const end = Date.now() + seconds * 1000;
const times: number[] = [];
let errors = 0;

async function call(init: RequestInit) {
  const started = performance.now();
  const ok = await fetch(`${values.url}/api/requests`, { headers, ...init })
    .then(async (response) => (await response.arrayBuffer(), response.ok))
    .catch(() => false);
  times.push(performance.now() - started);
  if (!ok) errors++;
}

async function worker(n: number) {
  for (let i = 0; Date.now() < end; i++) {
    await call({
      method: "POST",
      body: JSON.stringify({
        title: `Pallets for site ${n}-${i}`,
        body: "Three pallets of block.",
        team: "operations",
      }),
    });
    await call({});
  }
}

await Promise.all(
  Array.from({ length: Number(values.workers) }, (_, n) => worker(n)),
);
times.sort((a, b) => a - b);
const at = (p: number) => Math.round(times[Math.floor(p * (times.length - 1))]);
console.log(
  `${values.workers} workers, ${seconds} s: ${Math.round(times.length / seconds)} calls/s, p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, ${errors} errors in ${times.length}`,
);
