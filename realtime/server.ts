import { startRealtime } from "@/lib/realtime";

// One instance of the realtime server; run several, each on its own port, behind a load balancer that keeps a socket on one instance.
// Usage: PORT=3301 pnpm realtime
const port = Number(process.env.PORT ?? 3301);
await startRealtime(port);
// A platform stops an instance with SIGTERM. Nothing here needs finishing, and
// each page's socket opens again, on another instance or on this one restarted.
process.once("SIGTERM", () => process.exit(0));
console.log(`realtime on ws://localhost:${port}`);
