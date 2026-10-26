// What every page says about itself: where the site lives, who wrote it, and
// when it last changed. Answer engines weigh all three.
export const site = {
  // SITE_URL where it is set, Vercel's production address on Vercel, this machine otherwise.
  url:
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3001"),
  name: "WorkBot",
  author: "Anusheel Bhushan",
  updated: "2026-10-26",
};

/** The five questions a buyer asks first, each answered on its own page. */
export const questions = [
  {
    slug: "what-does-workbot-do",
    question: "What does WorkBot do for operations, finance and support teams?",
    answer:
      "WorkBot takes in the requests those teams receive, by chat, text message, WhatsApp, Slack, voice or a document, files each one with the right team, and answers questions from the company's own policies. It reads invoices and contracts into records, works through spreadsheets, and hands anything it should not decide to a person.",
  },
  {
    slug: "is-our-data-safe",
    question: "How does WorkBot keep a company's data separate and secure?",
    answer:
      "Every row carries its customer, and the database enforces that separation below the application. Each person's role is checked on every page, action and tool, outside the AI. Data is encrypted at rest under a key for each environment, every outbound call passes an allowlist, and a customer who needs it gets a deployment of its own.",
  },
  {
    slug: "what-does-it-cost",
    question: "What does WorkBot cost to run?",
    answer:
      "For about 1,000 monthly users on a managed platform, about $180 a month: hosting, the database, the job engine and the model. At 100,000 users it is about $2,250, of which the model is about 80%, so the model chosen for each task matters more than the platform.",
  },
  {
    slug: "can-it-run-in-our-cloud",
    question: "Can WorkBot run in our own cloud account?",
    answer:
      "Yes. WorkBot is two container images and a Postgres database, with Terraform for Google Cloud, a Kubernetes cluster and an Azure virtual machine. It runs in a customer's own project or cluster, released by tag, with its evaluations run on each release.",
  },
  {
    slug: "how-do-we-know-it-is-right",
    question: "How do we know WorkBot's answers are right?",
    answer:
      "Every change is measured against evaluation sets for chat, document extraction, triage and security, and a change that lowers a score does not ship. Every model call is traced with its cost and latency, and answers about policy cite the document they came from.",
  },
] as const;
