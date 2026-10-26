import { serve } from "inngest/next";
import { aeoWatch } from "@/inngest/aeo";
import { channelReply } from "@/inngest/channel-reply";
import { inngest } from "@/inngest/client";
import { dispatchEvents } from "@/inngest/dispatch-events";
import { documentApproval } from "@/inngest/document-approval";
import { reminders } from "@/inngest/reminders";
import { retention } from "@/inngest/retention";
import { reconcile, sync } from "@/inngest/sync";
import { watch } from "@/inngest/watch";

// The workflow engine's door: it calls this route to run each step, and
// reads the list of functions from it.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    aeoWatch,
    channelReply,
    dispatchEvents,
    documentApproval,
    reminders,
    reconcile,
    retention,
    sync,
    watch,
  ],
});
