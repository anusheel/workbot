# Hosting

Where WorkBot can run, what it costs at 1,000 and at 100,000 monthly active users, and which option to choose for a given customer. Prices are on-demand list prices in a US region, checked in October 2026; the database prices for AWS come from third-party price trackers. The steps to deploy are in [deploy.md](deploy.md).

## The system, as any cloud sees it

| Part               | What it is                                          | Neo-cloud                  | AWS                                   | Google Cloud              | Azure                          |
| ------------------ | --------------------------------------------------- | -------------------------- | ------------------------------------- | ------------------------- | ------------------------------ |
| Web and API        | the `web` image: Next.js, stateless                 | Vercel                     | ECS on Fargate behind a load balancer | Cloud Run                 | Container Apps                 |
| Jobs and workflows | Inngest, calling the web tier one step at a time    | Inngest Cloud              | Inngest Cloud, or self-hosted on ECS  | Inngest Cloud             | Inngest Cloud                  |
| Live calls         | the `tools` image running `realtime/server.ts`      | Render                     | ECS on Fargate, 2 tasks               | Cloud Run, 1 kept running | Container Apps                 |
| Browser            | Playwright's server, for the investigation          | a hosted browser service   | ECS on Fargate, private               | a hosted browser service  | Container Apps, internal       |
| Database           | Postgres 17 with pgvector, by a direct connection   | Supabase, or Neon          | RDS for PostgreSQL                    | Cloud SQL for PostgreSQL  | Azure Database for PostgreSQL  |
| Files              | in Postgres, 30 days for a document's bytes         | the same                   | the same; S3 when they outgrow it     | the same; Cloud Storage   | the same; Blob Storage         |
| Secrets            | the keys and the database URL, from the environment | the platform's environment | Secrets Manager                       | Secret Manager            | Key Vault                      |
| Identity           | what the services may touch                         | the platform's tokens      | an IAM role per task                  | a service account         | a managed identity             |
| Models             | Anthropic's API                                     | the same                   | the same, or Bedrock in region        | the same, or Vertex AI    | the same, or Microsoft Foundry |

Three choices made earlier keep every column open: everything runs in containers, everything kept is in Postgres, and the queue is an engine that runs anywhere. Nothing in the code names a cloud. Two products a customer might expect are absent on purpose. A cloud queue (SQS, Pub/Sub, Service Bus) would duplicate Inngest, which already retries and orders the work. Object storage waits until the bytes do not fit: at 100,000 users, documents of about 100 KB kept 30 days come to about 20 GB, which Postgres holds without strain.

The managed model endpoints matter to customers more than to the code. A regulated customer may accept a model only inside its own cloud account, in a named region, under an agreement its procurement team already holds. Bedrock, Vertex AI and Microsoft Foundry offer Claude under the cloud's own terms; for a given model and region, check where inference runs, who processes the data, and which agreement applies. Using one is a third entry in the providers of `src/lib/providers.ts`, and a route per task that names it.

## On this machine, shaped like a cloud

`compose.yaml` runs the system as a major cloud would: the web image, two realtime instances, Postgres with pgvector, Inngest self-hosted, and the browser service, each its own container on a private network.

```sh
COMMIT_SHA=$(git rev-parse HEAD) docker compose --env-file .env.compose up -d --build
docker compose --env-file .env.compose run --rm tools node --import tsx cli/eval.ts --task all --smoke --runs 2 --gate
```

On Docker Desktop with 4 CPUs and 8 GB, the stack passed what a deployment must:

| Check                                        | Result                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`                            | ok, database ok, and the commit the image was built from                                                                                               |
| Inngest's sync                               | 10 functions, served by the web container                                                                                                              |
| 2 documents through `POST /api/documents`    | each classified, stored, and a request opened by the workflow                                                                                          |
| The eval smoke suite, in the tools container | chat 0.95, extract 0.89, triage 0.88, security 1.00: every gate passed                                                                                 |
| The load test, 500 documents                 | none lost; the steady senders finished within 97 s, the noisy one's 300 in 368 s                                                                       |
| The realtime server                          | a socket that stops answering pings ended within 60 s; a client reopened its socket 2 s after it closed; a restart took 1 s, against about 10 s before |

Running in containers found five things that a laptop had hidden:

- **The investigation launched the machine's Chrome.** A container has none, and neither does a Vercel function. Both places that open a browser now connect to a Playwright server at `BROWSER_URL` when it is set; the stack runs one with no port outside its network.
- **Long connections were unattended.** A load balancer ends a quiet socket, after 60 s on AWS's by default, and every deploy restarts the instances. The server now pings each socket every 30 s and ends one that stops answering, both pages reopen theirs after 2 s, and the server exits at once on SIGTERM instead of waiting out the platform's grace period.
- **The session cookie reached only the app's own host.** The realtime server knows staff by that cookie, which works on `localhost` and fails across two cloud hostnames. `COOKIE_DOMAIN` extends it to a parent domain of WorkBot's own.
- **Only Vercel told the app its commit.** The images take `COMMIT_SHA` at build, so the health check and the eval records name the commit on any platform; the eval command had called `git`, which no image contains.
- **The images differ by a factor of six.** The web image is 532 MB, because the standalone server carries only what the routes import. The tools image is 3.2 GB: every dependency, including the musl builds of native packages, which pnpm installs because the lockfile does not record their C library. The realtime server runs from it, which costs a slower first start, not memory; a slim image of its own is the change if a platform starts it from zero.

## What it costs

Three assumptions drive the estimate, and every line below follows from them:

1. **Use.** A monthly active user has 20 assistant turns and sends 2 documents.
2. **The model's price per unit of work.** On the small models the routing table uses, a turn costs $0.0008 and a document $0.001, measured from this week's traces.
3. **The shape of the load.** A turn holds a server for about 8 s, nearly all of it waiting on the model, and the traffic falls in working hours.

Monthly, in dollars:

| 1,000 users                              | Web | Live calls | Database | Jobs | Network and other | Model | Total |
| ---------------------------------------- | --: | ---------: | -------: | ---: | ----------------: | ----: | ----: |
| Vercel, Supabase, Inngest Cloud, Render  |  20 |         14 |       29 |   99 |                 – |    18 |   180 |
| Cloud Run, Cloud SQL, Inngest Cloud      |   1 |         17 |      105 |   99 |                 – |    18 |   240 |
| ECS on Fargate, RDS, Inngest self-hosted |  29 |         14 |      100 |   41 |                60 |    18 |   262 |

| 100,000 users                            | Web | Live calls | Database | Jobs | Network and other | Model | Total |
| ---------------------------------------- | --: | ---------: | -------: | ---: | ----------------: | ----: | ----: |
| Vercel, Supabase, Inngest Cloud, Render  | 115 |         50 |      136 |  153 |                 – | 1,800 | 2,253 |
| Cloud Run, Cloud SQL, Inngest Cloud      |  61 |         34 |      236 |  153 |                 – | 1,800 | 2,284 |
| ECS on Fargate, RDS, Inngest self-hosted | 115 |         29 |      268 |   83 |               102 | 1,800 | 2,397 |

How the lines come out:

- **Web.** Vercel Pro is $20 a seat with $20 of usage included, more than 1,000 users spend; at 100,000, 2 GB instances held for each turn, at $0.0106 per GB-hour, and 21 million invocations. Cloud Run's free tier covers 1,000 users, and at 100,000 two instances run through working hours. Fargate keeps 2 tasks of half a vCPU at 1,000 users and 4 of one vCPU at 100,000.
- **Database.** Supabase Pro with the IPv4 add-on, on its Micro instance and then on Large (2 dedicated vCPUs, 8 GB). Cloud SQL and RDS are highly available across two zones, with 1 and then 2 vCPUs; the standby doubles their price, and Supabase's Pro has none.
- **Jobs.** Inngest counts a run and each of its steps. The heartbeat that delivers domain events runs every minute, 86,400 executions a month at any traffic, past the free 50,000, so the $99 plan starts with the first user. At 100,000 users, documents at 6 executions each and text replies at 4 come to 2.1 million. Self-hosted on AWS, the engine is 1 or 2 tasks and a small Redis.
- **Network and other.** On AWS the tasks sit in private subnets and reach the model's API through a NAT gateway, and the load balancer has an hourly price; logs and secrets add a few dollars. Vercel and Cloud Run include all of it.

What the numbers say:

- **At 1,000 users the platform is the bill**, about 90% of it, and most of that is minimums: a standby database, the job engine's plan, instances kept running. The heartbeat alone moves Inngest from free to $99; requesting delivery when an event is written, with a sweep every ten minutes, would bring it under the free tier.
- **At 100,000 users the model is the bill**, 75 to 80% of it, and the three platforms are within 7% of each other. At that scale the platform is chosen for control and compliance, not price. The levers are the model's: the large model is priced at 20 times the small one, so every turn on it would take the model's line from $1,800 to about $32,000.
- **Allocation is already in place.** The runbook gives each environment its own project and labels what takes labels by app and environment, and the services by tier, which splits the platform bill; the model bill is split by the traces, which record each call's tenant, task, model and dollars.

## Recommendation: Fieldstone Supply

**The customer.** Fieldstone Supply is a building-supply company: one warehouse in Oakland, six delivery vans, operations, finance and support teams, and the contractors who text and call them. It has no cloud account, no platform engineer, and no regulator over its data beyond ordinary privacy law. Its staff and its contractors come to about 1,000 monthly users.

**The decision.** Run WorkBot on the neo-cloud: Vercel for the web tier, Supabase for Postgres, Inngest Cloud for the jobs, and Render for the realtime server, all in a US West region.

**Reason 1: nobody at Fieldstone has to run a network.** There are no subnets, NAT gateways, load balancers or IAM policies to design, review and keep current; the platforms patch and scale themselves. The people who look after WorkBot are its builders, part time, and an hour not spent on infrastructure is an hour on the assistant. It is also the cheapest option at Fieldstone's size, $180 a month against $240 and $262, though a difference of $60 to $82 a month is not the reason.

**Reason 2: the choice can be undone in a day.** The images Render runs are the ones `compose.yaml` runs in the shape of a major cloud, and the database is Postgres with pgvector, which `pg_dump` moves. If Fieldstone is acquired, audited, or grows a hundredfold, moving to Cloud Run or ECS is the runbook in [deploy.md](deploy.md), not a rewrite. At 100,000 users the platforms cost within 7% of each other, so price will not force the move either.

**What the $180 covers, and what it does not.** It covers hosting, the database, the job engine, the realtime server and the model, at the assumptions above. It leaves out the text messages and calls sent through Twilio (billed per message by Twilio to Fieldstone's own account), a staging environment (about $50 more, mostly a second database), point-in-time recovery for the database, and seats past the first on Vercel at $20 each. Set one budget alert across the providers at $225, and a second on the model's account at $40, which is twice its expected spend and the first sign of a fallback to the large model.

**What it gives up.** Supabase's Pro instance has no standby: a failure in its zone is a restore, and with only the daily backup that Pro includes, up to a day of requests lost. Point-in-time recovery is an add-on, and it should be bought once WorkBot is where the team's requests live.

**When the answer changes.** Harbor Dental, the other customer in `content/customers`, is three dental clinics whose conversations carry patient data. Under HIPAA every vendor that touches it signs a business associate agreement, and on the neo-cloud that is four vendors and their upper tiers: Vercel's agreement is a $350 monthly add-on to Pro, and Supabase's needs the Team plan at $599 a month and an add-on of its own. Google signs one agreement, at no charge, that covers Cloud Run, Cloud SQL and Secret Manager. For Harbor Dental the recommendation is Google Cloud, with Inngest self-hosted in the same project and the model under its provider's agreement. An enterprise with an AWS landing zone gets ECS in its own account, for a further reason: its security team already knows how to review it.
