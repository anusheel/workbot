import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { documentApproval } from "@/inngest/document-approval";
import { reminders } from "@/inngest/reminders";
import { watch } from "@/inngest/watch";

// The workflow engine's door: it calls this route to run each step, and
// reads the list of functions from it.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [documentApproval, reminders, watch],
});
