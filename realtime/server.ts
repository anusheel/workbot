import { startRealtime } from "@/lib/realtime";

// One instance of the realtime server; run several, each on its own port, behind a load balancer that keeps a socket on one instance.
// Usage: PORT=3301 pnpm realtime
const port = Number(process.env.PORT ?? 3301);
await startRealtime(port);
console.log(`realtime on ws://localhost:${port}`);
