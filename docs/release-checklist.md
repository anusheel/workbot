# Release checklist

What must hold before WorkBot serves a customer, each item with where it was checked. Run against the most recent full deployment: the local cluster of Day 35 and 36, recreated from nothing by the pipeline's own scripts. The cloud deployments are written and planned in tests but not applied, so the items that need an account say so.

| Item                                                   | Status  | Evidence                                                                                                         |
| ------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| The eval smoke suite passes on the release             | done    | `helm test` in the cluster: chat 0.94, extract 0.92, triage 0.88, security 1.00                                  |
| The load test loses nothing and stays fair             | done    | 500 documents, steady senders within 97 s, failures in the dead letters ([infrastructure.md](infrastructure.md)) |
| A bad release rolls back by itself                     | done    | a crashing tag never took traffic; the previous release was restored                                             |
| The environment can be rebuilt from code               | done    | destroyed in 22 s, recreated in 512 s with the smoke suite                                                       |
| No secret in an image, the repository or a state file  | done    | write-only arguments, secrets created empty, `.env*` ignored                                                     |
| Data encrypted at rest under the customer's key        | planned | KMS key per environment, asserted in `terraform test`; needs the account to apply                                |
| Backups with point-in-time recovery                    | planned | in `infra/gcp`, asserted in the plan; needs the account                                                          |
| Health watched from outside                            | planned | an uptime check on `/api/health` in `infra/gcp`; needs the account                                               |
| Spend alerts                                           | planned | a budget at 50, 90 and 100% in `infra/gcp`; needs the billing account                                            |
| Outbound calls restricted and logged                   | done    | egress proxy refused a host off the allowlist and logged it ([isolation.md](isolation.md))                       |
| Tenants isolated                                       | done    | row-level security; a tenant's namespace unreachable from another's                                              |
| Runbooks for the likely failures                       | done    | provider outage (rehearsed), runaway import, looping worker                                                      |
| Retention set and enforced                             | done    | per-kind windows in `content/defaults.json`, a nightly job                                                       |
| A security review pack                                 | done    | [review.md](review.md), [security.md](security.md), [questionnaire.md](questionnaire.md)                         |
| An on-call owner named, with the alerts routed to them | open    | the customer's decision                                                                                          |
| Deployed into the customer's account by their engineer | open    | a simulated walkthrough only ([research.md](research.md)); needs the customer                                    |
