# Deploying

The steps to put WorkBot on a neo-cloud and on Google Cloud; the same Google Cloud deployment as Terraform is in [infrastructure.md](infrastructure.md). They have not been run: each creates billed resources in an account, and that is the account owner's decision. Every piece was proven in the containers of `compose.yaml` (see [hosting.md](hosting.md)), and every flag below was checked against the installed `gcloud`.

What any target must provide:

- **Postgres 17 with pgvector, by a direct connection.** The app sets its tenant and role when a session starts, takes an advisory lock while it applies the schema, and the realtime server listens for notifications. A transaction pooler carries none of these, so a platform's pooled URL will not work. Where a platform injects both, the app reads `DATABASE_URL_UNPOOLED` first.
- **The web image** (`--target web`), on port 3000, with requests allowed 300 s for the investigation.
- **The realtime server** (`--target tools`, `node --import tsx realtime/server.ts`), at least one instance kept running, on `PORT`.
- **Inngest**, Cloud or self-hosted, able to reach `/api/inngest` on the web tier.
- **A browser service** at `BROWSER_URL` for the investigation, speaking Playwright 1.64: a container on a private network, as in `compose.yaml`, or a hosted service with a token in the URL. Whoever reaches it drives a browser.
- **Secrets**: `ANTHROPIC_API_KEY`, the database URL, `SECRETS_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, and the browser service's URL when it carries a token.
- **One domain for the app and the realtime server.** The realtime server knows staff by their session cookie, which a browser sends only to the hosts the cookie covers. Give the two services names under a domain of their own, `app.workbot.<customer>` and `live.workbot.<customer>`, and set `COOKIE_DOMAIN` to `workbot.<customer>`; a parent shared with other sites would hand them the cookie too.
- **Settings**: `CUSTOMER`, `APP_URL` (`https://app.…`), `REALTIME_URL` (`wss://live.…`), `COOKIE_DOMAIN`.

After the first deploy, on any target, run once from the tools image against the production database: `cli/index-knowledge.ts`, then `cli/users.ts add "<name>" --role admin`. The key it prints is the first admin's; sign in, issue yourself a key from Users, and revoke the printed one, since a job's output is kept in the platform's logs.

## Neo-cloud: Vercel, Supabase, Inngest Cloud, Render

1. **Database.** Create a Supabase project on Pro in the customer's region, enable the `vector` extension, and buy the IPv4 add-on: the direct connection is IPv6 only without it, and Vercel's functions cannot reach IPv6. Copy the direct connection string, port 5432, not the pooler's.
2. **Web.** Import the GitHub repository into a Vercel project on Pro, with the function region next to the database; the routes declare their own maximum durations. Add `app.workbot.<customer>` as its domain, and the secrets and settings above for Production with `vercel env add <NAME> production`.
3. **Jobs.** Install the Inngest integration from the Vercel Marketplace; it sets the two Inngest keys and syncs the functions on every deploy.
4. **Realtime.** On Render, create a web service from the repository with Docker target `tools`, start command `node --import tsx realtime/server.ts`, the database URL and `APP_URL`, and the domain `live.workbot.<customer>`.
5. **Browser.** A function on Vercel reaches no private network, so `BROWSER_URL` is a hosted browser service that accepts Playwright connections, its token in the URL, kept as a secret.
6. **Deploy and check.** `vercel deploy --prod`, then `curl $APP_URL/api/health` shows the commit. Run the eval smoke suite and the load test from a machine holding the production secrets, with the tools image: `docker run --rm --env-file prod.env workbot-tools node --import tsx cli/eval.ts --task all --smoke --runs 2 --gate`, then `cli/load.ts`.

### A database branch per pull request

Previews never touch the customer's data. A Neon project holds a `main` branch with the schema and the demo data only, and the Neon integration for Vercel (Neon-managed, under Connectable Accounts) creates a branch `preview/<git-branch>` from it for each preview deployment and injects its URLs into that deployment alone. With "Automatically delete obsolete Neon branches" on, a branch goes when its Git branch is merged or deleted; this repository keeps its day branches, so their previews' databases are deleted by hand. The integration requires the Vercel project to be linked to the GitHub repository.

## Google Cloud: Cloud Run, Cloud SQL, Secret Manager

These are the steps by hand, with the realtime server on a host of its own and `COOKIE_DOMAIN` over both. The Terraform in `infra/gcp` makes the same deployment with both on one host behind a load balancer, and its ordered sequence is in [infrastructure.md](infrastructure.md); use one or the other.

One project per environment, a budget before anything runs, one service account that can read its secrets and nothing else. The database has only a private address, and the services reach it through the project's network.

```sh
PROJECT=workbot-prod REGION=us-central1 DOMAIN=workbot.example.com LABELS=app=workbot,env=prod
TAG=$(git rev-parse --short HEAD) IMAGES=$REGION-docker.pkg.dev/$PROJECT/workbot

gcloud projects create $PROJECT --labels=$LABELS
gcloud billing projects link $PROJECT --billing-account=$BILLING_ACCOUNT
gcloud billing budgets create --billing-account=$BILLING_ACCOUNT --display-name=workbot-prod \
  --budget-amount=300USD --filter-projects=projects/$PROJECT \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com servicenetworking.googleapis.com compute.googleapis.com
```

**Images.** Cloud Run runs x86-64 images only, so a build on Apple silicon names the platform.

```sh
gcloud artifacts repositories create workbot --repository-format=docker --location=$REGION --labels=$LABELS
gcloud auth configure-docker $REGION-docker.pkg.dev
for target in web tools; do
  docker buildx build --platform linux/amd64 --target $target \
    --build-arg COMMIT_SHA=$(git rev-parse HEAD) -t $IMAGES/$target:$TAG --push .
done
```

**Database.** High availability across two zones, daily backups with point-in-time recovery, a private address only.

```sh
gcloud compute addresses create google-services --global --purpose=VPC_PEERING \
  --prefix-length=16 --network=default
gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com \
  --ranges=google-services --network=default
gcloud sql instances create workbot --database-version=POSTGRES_17 --edition=ENTERPRISE \
  --tier=db-custom-1-3840 --availability-type=REGIONAL --region=$REGION \
  --network=default --no-assign-ip --storage-size=20 \
  --backup-start-time=03:00 --enable-point-in-time-recovery
gcloud sql databases create workbot --instance=workbot
DB_PASSWORD=$(openssl rand -hex 24)
gcloud sql users create workbot --instance=workbot --password="$DB_PASSWORD"
DB_HOST=$(gcloud sql instances describe workbot --format='value(ipAddresses[0].ipAddress)')
```

**Secrets and the service account.** Values go in through standard input, so none lands in the shell's history. `BROWSER_URL` is a hosted browser service's address with its token, as for Vercel: a browser on Cloud Run would want an identity token that the Playwright client does not send.

```sh
printf 'postgres://workbot:%s@%s:5432/workbot' "$DB_PASSWORD" "$DB_HOST" |
  gcloud secrets create database-url --data-file=- --labels=$LABELS
printf %s "$ANTHROPIC_API_KEY" | gcloud secrets create anthropic-api-key --data-file=- --labels=$LABELS
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create secrets-key --data-file=- --labels=$LABELS
printf %s "$INNGEST_EVENT_KEY" | gcloud secrets create inngest-event-key --data-file=- --labels=$LABELS
printf %s "$INNGEST_SIGNING_KEY" | gcloud secrets create inngest-signing-key --data-file=- --labels=$LABELS
printf %s "$BROWSER_URL" | gcloud secrets create browser-url --data-file=- --labels=$LABELS

gcloud iam service-accounts create workbot-run --display-name="WorkBot services"
SA=workbot-run@$PROJECT.iam.gserviceaccount.com
for secret in database-url anthropic-api-key secrets-key inngest-event-key inngest-signing-key browser-url; do
  gcloud secrets add-iam-policy-binding $secret --member=serviceAccount:$SA \
    --role=roles/secretmanager.secretAccessor
done
```

**Services.** The same network flags on each, so the private address is reachable and everything else leaves directly.

```sh
NET="--region=$REGION --service-account=$SA --network=default --subnet=default --vpc-egress=private-ranges-only"
SECRETS=DATABASE_URL=database-url:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest,SECRETS_KEY=secrets-key:latest,INNGEST_EVENT_KEY=inngest-event-key:latest,INNGEST_SIGNING_KEY=inngest-signing-key:latest,BROWSER_URL=browser-url:latest

gcloud run deploy workbot-web --image=$IMAGES/web:$TAG $NET --set-secrets=$SECRETS \
  --set-env-vars=CUSTOMER=fieldstone,APP_URL=https://app.$DOMAIN,REALTIME_URL=wss://live.$DOMAIN,COOKIE_DOMAIN=$DOMAIN \
  --cpu=1 --memory=1Gi --concurrency=40 --timeout=300 --allow-unauthenticated \
  --labels=$LABELS,tier=web
gcloud run deploy workbot-realtime --image=$IMAGES/tools:$TAG $NET \
  --command=node --args=--import,tsx,realtime/server.ts \
  --set-secrets=DATABASE_URL=database-url:latest --set-env-vars=APP_URL=https://app.$DOMAIN \
  --min-instances=1 --max-instances=4 --timeout=3600 --allow-unauthenticated \
  --labels=$LABELS,tier=realtime
gcloud run domain-mappings create --service=workbot-web --domain=app.$DOMAIN --region=$REGION
gcloud run domain-mappings create --service=workbot-realtime --domain=live.$DOMAIN --region=$REGION
curl -X PUT https://app.$DOMAIN/api/inngest
```

Each mapping prints the DNS records to add at the customer's registrar. The last line registers the functions with Inngest Cloud. Cloud Run ends a WebSocket at the request timeout, at most an hour; the page and the call open theirs again.

**The checks, as jobs on the same network.**

```sh
gcloud run jobs create workbot-eval --image=$IMAGES/tools:$TAG $NET --set-secrets=$SECRETS --labels=$LABELS \
  --command=node --args=--import,tsx,cli/eval.ts,--task,all,--smoke,--runs,2,--gate
gcloud run jobs create workbot-load --image=$IMAGES/tools:$TAG $NET --set-secrets=$SECRETS --labels=$LABELS \
  --command=node --args=--import,tsx,cli/load.ts --task-timeout=45m
gcloud run jobs execute workbot-eval --region=$REGION --wait
gcloud run jobs execute workbot-load --region=$REGION --wait
```

## On AWS

The same shape: the web image on ECS with Fargate behind an Application Load Balancer, the tools image as a second service of two tasks, RDS for PostgreSQL Multi-AZ, Secrets Manager read by the tasks' role, and the checks as one-off tasks with `aws ecs run-task`. Two things differ in cost and in effort. The tasks sit in private subnets and reach the model's API through a NAT gateway, about $33 a month before traffic. And the load balancer ends a quiet WebSocket after 60 s by default, which the realtime server's 30 s ping already covers.
