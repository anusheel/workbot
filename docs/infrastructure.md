# Infrastructure

WorkBot's infrastructure as code, on three targets, and the pipeline that changes it. The same two images run on each: Cloud Run on Google Cloud, any Kubernetes cluster, and a virtual machine on Azure. Day 34's [deploy.md](deploy.md) is the same Google Cloud deployment as steps to type; this is the version a machine applies.

| Target                  | What it is for                                                           | Where it is                       | Proven by                                                            |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| Cloud Run and Cloud SQL | the default: managed containers and a managed database, nothing to patch | `infra/gcp`, `infra/modules`      | plans of staging and production against a mocked provider            |
| Kubernetes              | a customer whose platform team runs clusters and wants everything on one | `infra/kubernetes`, `infra/chart` | applied to a local cluster: released, scaled, rolled back, recreated |
| An Azure VM             | a customer whose policy allows only virtual machines it hardens          | `infra/azure`                     | a mocked plan, and the unit and its container run locally            |

The order of preference is the table's: managed containers first, Kubernetes when the customer's platform team runs it and wants WorkBot there too, a virtual machine when policy demands one. Each step down adds work the customer's team or ours must do, from patching nodes to rotating the VM's image.

## Terraform

- **One root per target, one state per environment.** `infra/gcp`, `infra/kubernetes` and `infra/azure` are applied on their own. Staging and production are the same root with a variable file each, `staging.tfvars` and `production.tfvars`, and a state each under its own prefix. Staging has a database without a standby that can be destroyed and an idle cost near zero; production has a standby, deletion protection and one web instance kept warm.
- **A module for what is made more than once.** The web tier and the realtime server are both a Cloud Run service with the same network, secrets and lifecycle, so they are one module, `infra/modules/cloud-run-service`, used twice. The database, made once per environment, stays in its root.
- **State remote and locked.** Google Cloud's in a bucket, Azure's in a storage container, the cluster's in Postgres outside the cluster; each backend takes a lock, so a second apply waits for the first. The bucket is the one thing made by hand, once per account, before Terraform can run.
- **No secret in the state.** A password made by `random_password` is written to the state in plain text. Here it is ephemeral: it exists while Terraform runs and goes into write-only arguments (`password_wo`, `secret_data_wo`, the cluster secret's `data_wo`), so neither a plan nor the state holds it. The API keys never pass through Terraform at all: it creates each secret empty, and an operator adds the value. The price is that Terraform cannot see a change to a value it never stored, so a revision number tells it to write again.
- **Releases are not applies.** Terraform creates each service with a first tag and ignores the image from then on: on Cloud Run a release is `gcloud run deploy`, on the cluster it is `infra/release.sh`. Changes to the infrastructure go through a plan and a reviewer; releases go through the smoke suite.
- **Tests that read the plan.** `terraform test` plans staging and production against mocked providers and asserts the decisions: a standby only in production, no public address on the database, the password absent from the plan, the realtime server under `/realtime`, the VM with no SSH and its container read-only. They run on every pull request, with no account.

## Kubernetes

Two layers. `infra/kubernetes` is the platform, applied by Terraform: the Gateway API's resource types from the project's own manifest (too large for a Helm release, which Helm keeps in one Secret of at most 1 MiB), Traefik serving the Gateway API (ingress-nginx was retired in 2026), KEDA, the namespace, and the secrets written once. `infra/chart` is the app, installed by a release: every service from one template looping over `values.yaml`, Postgres for a cluster that stands alone, a Gateway and a route that serve the realtime server under `/realtime` on the app's host, scaling on the queue, the migration as a hook, and the smoke suite as the release's test.

Measured on a local kind cluster, which stands in for a clean account:

| What                                    | Result                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A release on an empty namespace         | installed, migrated, every eval gate passed in the cluster: chat 0.92, extract 0.92, triage 0.88, security 1.00 |
| 500 documents from the load test        | the web tier went from 1 replica to 4 within 10 s of 482 documents waiting                                      |
| A release whose pods never become ready | the old pods kept serving; after Helm's 10-minute wait the previous release was restored                        |
| Destroy, then recreate from nothing     | destroyed in 22 s; recreated in 512 s, the smoke suite included: cluster, images, platform, release             |

What the cluster found that the containers had not:

- **Kubernetes names variables after services.** Each pod got `INNGEST_PORT=tcp://…` for the `inngest` service, which Inngest read as its own port and started on port 0. `enableServiceLinks: false` on every pod.
- **A user by name cannot be checked.** `runAsNonRoot` refuses an image whose user is `node`, so the images now name user 1000.
- **A database down at start stopped a server for good.** The web pod's first query ran before Postgres was ready, and the failed connection was cached for every query after; it is now tried again. Compose had hidden this by starting the database first.
- **A name is short only in its own namespace.** KEDA reads the queue from its own namespace, so the database's address is the service's full name.

Open: in the cluster's load test one of the noisy sender's 300 documents was never picked up and stayed `received`, and the self-hosted engine logged events rejected for an unrecognized key at about one every two seconds, more under load, though every document event the test sent was accepted and all 100 failures reached the dead letters. The source of the rejected events is not yet found; the Compose run lost nothing.

The web tier scales on documents waiting to be read, one replica per 20, from 1 to 4, because Inngest calls it to run each step. Past the engine's own limit of 10 steps at once, more replicas add nothing, so the two numbers are set together.

## The Azure VM

`infra/azure` makes a resource group, a network with one subnet, a security group that admits only the app's port and nothing for SSH, a Standard load balancer whose probe reads `/api/health` and whose rule takes port 80 to 3000, an outbound rule (a new subnet on Azure has no default way out), and an Ubuntu 24.04 VM with an identity of its own. The keys are in Key Vault, which the VM's identity may read and nothing else.

The VM's setup is one cloud-init file. It installs Docker and `jq`, writes a script that asks the instance metadata service for a token and reads each secret from Key Vault into `/run`, which lives in memory, and installs a systemd unit. The unit writes that environment, then runs the web image read-only, with every capability dropped and no privilege escalation, and restarts it if it stops.

What was checked without an Azure subscription:

- The rendered cloud-init passes `cloud-init schema` on Ubuntu 24.04, and the unit passes `systemd-analyze verify` there once Docker's package is installed.
- The unit's own `docker run` line, run here against Postgres, served `/api/health` with the database ok, its root filesystem read-only, all capabilities dropped and user 1000.
- Not checked: the Key Vault read and the VM itself, which need the subscription.

A VM is the most work of the three to keep: the operating system's patches, a fresh image now and then, and one VM is one zone, so availability means a scale set across zones.

## The pipeline

- **Every pull request** that touches `infra/` formats, validates and tests all three roots, and lints the chart (`.github/workflows/infra.yml`). None of it needs an account.
- **Once Google Cloud is connected**, by four repository variables, a pull request also shows the real plan, and a merge applies it in the `production` environment, which waits for a reviewer. The runner signs in through workload identity federation, so no key is stored in GitHub.
- **A tag releases its commit** (`.github/workflows/release.yml`): both images built once and pushed under the commit's hash, then `infra/release.sh` on the cluster, also behind the reviewer. Promotion is by tag: the image a tag names is the one staging already ran, not a rebuild.
- **`infra/release.sh`** is the whole release: a Helm upgrade that migrates first, waits for the new pods and restores the previous release if they never become ready, then the eval smoke suite as the release's test, and a rollback if it fails.
- **Migrations go forward only.** The schema is `create … if not exists` and `add column if not exists`, applied before the new pods start, so the version still running keeps working. Removing a column takes two releases: one that stops reading it, one that drops it.
