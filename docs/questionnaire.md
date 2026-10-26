# Security questionnaire

The 20 questions a customer's vendor review asks most, answered for WorkBot as built. Each answer names where it can be checked.

1. **Where is our data stored and processed?** In the cloud region the deployment names (`region` in `infra/gcp`), in Postgres and Secret Manager there. Model calls go to the model provider's API, or to the provider's endpoint inside the customer's cloud when that is required ([hosting.md](hosting.md)).
2. **Is data encrypted at rest?** Yes: the database and every secret under a KMS key per environment, rotated every 90 days; integration tokens are also sealed by the app ([isolation.md](isolation.md)).
3. **Is data encrypted in transit?** Yes: HTTPS at the load balancer with a managed certificate, TLS to the model's API and every other service. Inside the project's network the database is reached on a private address.
4. **Is our data separated from other customers'?** Every row carries its tenant, and Postgres's row-level security enforces it below the app; a customer may also have a stack of its own: project, database, key ([security.md](security.md), [isolation.md](isolation.md)).
5. **Who can access production?** The services' own account, which may read their secrets and nothing else, and named operators through the cloud's IAM. No shared accounts, no keys in the repository.
6. **How do users authenticate, and are roles enforced?** Per-person keys and sessions, three roles (viewer, agent, admin) checked on every page, action, route and tool, below the model.
7. **Is access logged?** Sign-ins and actions by person; reads of secrets and uses of the key in the cloud's data-access logs; every model call in the traces with its tenant and task.
8. **Do you use our data to train models?** No. The model providers' API terms exclude API data from training; no data is sent anywhere else.
9. **What do you send to the model provider?** The question, the context retrieved for it, and the conversation, and nothing the user's role may not read. The traces kept of those calls have emails, phone numbers and keys removed.
10. **How long do you keep data?** By configuration, per kind: conversations 90 days, a document's bytes 30 days, traces and measurements as set (`content/defaults.json`), enforced by a nightly job.
11. **Can you delete our data on request?** Yes: a tenant's rows by tenant, or a tenant's whole stack, whose key can be destroyed so its backups are unreadable too.
12. **How do you defend against prompt injection?** Tools are checked against the user's role below the model, writes need a key and a dry run, and 20 injection attempts run as an eval on every pull request ([security.md](security.md)).
13. **Can the agent reach arbitrary sites?** No: outbound calls go through an egress proxy with an allowlist and a log; the agent's browser is bounded to the pages it was asked about.
14. **How are secrets managed?** In the cloud's secret store, never in images or the repository; Terraform creates them empty and keeps generated passwords out of its state.
15. **How are changes reviewed and deployed?** Every change is a pull request with tests, evals and a review; infrastructure applies after a reviewer approves; releases run the eval smoke suite and roll back on failure ([infrastructure.md](infrastructure.md)).
16. **How do you manage vulnerabilities in dependencies?** A locked dependency tree, images rebuilt from it per commit, the runtime's base image pinned and updated with it, and the cloud's managed services patched by the provider.
17. **What is your availability design?** Managed services in one region; a database standby in a second zone in production; stateless web and realtime tiers on several instances; durable jobs that survive restarts.
18. **What are your backup and recovery objectives?** Daily backups with point-in-time recovery on the database (a recovery point of minutes); recovery of the stack from code in under 10 minutes on a cluster, as measured.
19. **How would you notify us of an incident?** Within the contract's window, with what is known, what is affected and what is being done; the runbooks cover provider outages, runaway imports and looping workers ([isolation.md](isolation.md)).
20. **Which subprocessors do you use?** The cloud provider, the model provider, and, when the customer enables them, Inngest Cloud, Twilio, Slack, Voyage, Brave and PostHog; each can be replaced by the customer's own or turned off.
