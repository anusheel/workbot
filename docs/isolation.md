# Isolation, keys and scale

What keeps one customer's data from another's and from the internet, who holds the keys, how far one deployment stretches, and what to do when it breaks. The controls inside the app (roles, row-level security, sealed tokens, injection evals) are in [security.md](security.md); this is the layer under them.

## The network

| Tier | What runs there                             | Reachable from                       |
| ---- | ------------------------------------------- | ------------------------------------ |
| Edge | the load balancer, or the cluster's Gateway | the internet, on 443                 |
| App  | the web tier, the realtime server, the jobs | the edge only                        |
| Data | Postgres, on a private address              | the app tier only; no public address |

- **No public database.** On Google Cloud the instance has only a private address on the project's network; in the cluster each tenant's Postgres admits connections from its own namespace alone.
- **Cloud services by private routes.** Cloud Run reaches Secret Manager, KMS and Cloud SQL over Google's network; nothing the app reads from the cloud crosses the internet.
- **One way out.** Every outbound call goes through an egress proxy (`infra/egress`): an allowlist of hosts and a log line per request. The model's API, Voyage, Brave, Twilio, Slack, GitHub, PostHog and Inngest are on it; a page the agent may read is added by host, for the customer who wants it read. Node's own `fetch` honours the proxy with `NODE_USE_ENV_PROXY=1`, and the agent's browser is given it directly. Checked: through the proxy, the model's API answered (401, with no key sent) and `example.com` was refused with 403, both in the log. In a VPC the proxy is the only route out; locally it is a setting.

## Keys

- **One KMS key per environment**, rotated every 90 days (`infra/gcp`). The database and every secret are encrypted under it: each is encrypted with a data key of its own, and the data keys with this one, which never leaves KMS. Destroying the key makes the environment's data unreadable, which is also how a customer's data is ended for good.
- **Agent credentials** are sealed by the app with `SECRETS_KEY` (Day 30); that key is a secret, so it too sits under the environment's KMS key.
- **Access is audited.** Data-access logs record every read of a secret and every use of the key, and only the services' account may read the secrets.
- **Rotation** of the KMS key is automatic and needs nothing from the app. Rotating `SECRETS_KEY` is `pnpm users reseal` with the old key set as `SECRETS_KEY_PREVIOUS`.

## A customer kept apart

The single-tenant option is the same code with one variable more. On Google Cloud it is a variable file, `infra/gcp/harbor-dental.tfvars`: the customer's own project, database, key and services, on its own host. On a cluster it is a tenant in `infra/kubernetes`: a namespace with its own secrets, its own Postgres and password, and a network policy that admits traffic only from inside it, the gateway and KEDA; the chart answers on the tenant's host.

Deployed on the local cluster for Harbor Dental: its stack released on `harbor-dental.localhost` with its own database, and a pod in the shared namespace timed out connecting to Harbor's database while Harbor's own pod connected.

## Scale

Ten times today's load, from the Day 34 model: 10,000 monthly users.

| Resource             | Today (1,000 users) | Ten times         | Limit and what gives first                                      |
| -------------------- | ------------------- | ----------------- | --------------------------------------------------------------- |
| Assistant turns      | 20,000 a month      | 200,000           | peak about 1 turn a second; the model's rate limit, not the app |
| Documents read       | 2,000 a month       | 20,000            | Inngest's 10 steps at once: about 3 documents a second          |
| Inngest executions   | 106,000 a month     | 290,000           | inside the paid plan's million                                  |
| Database connections | 10 per web instance | 40 at 4 instances | Postgres's default 100                                          |
| Model spend          | $18 a month         | $180              | the bill, not a limit                                           |

The load test (`pnpm bench`) creates and lists requests as fast as answers come. Run on the local cluster until something broke, fixed, and run again:

| Round | Load                    | Result                               | What broke                                                                                                            | Fix                                                             |
| ----- | ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | 10 → 50 workers         | 342 → 161 calls/s, p50 25 → 316 ms   | each list returned the whole table, 10,000 rows and 1 MB                                                              | list the newest 100                                             |
| 2     | 50 → 200 workers        | 1,064 → 917 calls/s, p50 45 → 221 ms | one web replica: KEDA scaled only on the queue                                                                        | a CPU trigger beside the queue's                                |
| 3     | 200 workers, 4 replicas | 501 calls/s, p95 812 ms, 70 errors   | Postgres at 1.8 cores: no index for the list, and every new replica re-ran the schema's DDL, deadlocking with inserts | an index on tenant and age; the schema applied once per version |
| 4     | 200 workers, 4 replicas | 846 calls/s, p95 573 ms, no errors   | the machine: one 4-CPU node runs the bench, Postgres and every replica                                                | more nodes, which a real cluster has                            |

The third round's cause was a deployment fault no single server shows: scaling out made the app slower, because each new instance took table locks at start.

## Runbooks

**A model provider is down.** Signs: errors on the route's provider in `/admin/traces`, the hourly watch's alert. The routing table already falls back to the other model or provider for outages, rate limits and network failures. Check that answers are still passing (the eval smoke suite), watch the cost, and if the outage outlasts the day, set `OUTAGE` to the provider so no call waits on it. Game day, run with the small model marked out: the chat suite scored 0.99 against its 0.94 baseline on the large model, at about 22 times the cost per answer ($0.0146 against $0.00067) and a p95 of 4.0 s against 2.9 s. The fallback holds quality; the risk is the bill, which `ALERT_DAILY_DOLLARS` watches.

**Model spend runs away.** Signs: the hourly watch's alert past `ALERT_DAILY_DOLLARS`, answers slower than usual. First, `/admin/traces`: a failed small-model call followed by a large-model one on each turn means the fallback is carrying traffic (above, about 22 times the cost); one caller holding most of the spend means a loop or abuse; a prompt version taking the spend means a costlier version is in the experiment, and `/admin/prompts` moves its share back. Then `/admin/jobs` and Inngest's dashboard for a looping run, and the provider's status page for an outage. There is no switch today that holds the spend without taking the assistant down: `OUTAGE=anthropic` stops every route, and `ROUTES` adds a model in front without removing the fallback. A daily dollar cap that turns the large-model fallback off is in the backlog; until then, a costly fallback is stopped by a release of the customer file without it.

**A tenant's import runs away.** Signs: one owner's documents filling `/admin/jobs`, the web tier at its maximum replicas. Each sender is capped at 2 documents at once of 10, so the others keep moving (Day 33's load test). Find the owner in the dead letters, ask the customer to stop the source, and send back what failed once the cause is fixed. If the backlog itself is the problem, pause the sender's integration key with `pnpm users revoke`.

**A worker loops.** Signs: one function's runs retrying without end, cost rising on one task in the traces. Errors no retry can fix end at once (`failFast`), others stop after 3 tries and land in the dead letters, and an agent's run is bounded by its step and cost limits. If a run still repeats, cancel it in Inngest's dashboard, fix the cause, and replay the dead letter.

## The security questionnaire

The 20 questions a vendor review asks most, answered for WorkBot, are in [questionnaire.md](questionnaire.md).
