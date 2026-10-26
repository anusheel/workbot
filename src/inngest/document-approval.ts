import { NonRetriableError } from "inngest";
import { modelFor } from "@/lib/routing";
import { type Extracted, schemas } from "@/lib/document-model";
import { classify, saveDocument, toRequest } from "@/lib/documents";
import { type Source, extract, route } from "@/lib/extract";
import { fileOf, getItem, markFailed, updateItem } from "@/lib/inbox";
import { notify } from "@/lib/notify";
import { createRequest, getRequest } from "@/lib/requests";
import { withTrace } from "@/lib/tracing";
import { inngest } from "./client";
import { documentReceived, documentReviewed } from "./events";

/**
 * The document approval workflow: classify, extract, validate, a reviewer
 * when a field is doubtful, store, notify. Each step is checkpointed and
 * retried on its own, so a crash or a restart resumes at the step that
 * failed, and the wait for a reviewer holds no server.
 */
export const documentApproval = inngest.createFunction(
  {
    id: "document-approval",
    retries: 3,
    triggers: [documentReceived],
    // The run gave up: the row shows it, with the reason, for a person to act on.
    onFailure: ({ event, error }) =>
      markFailed(event.data.event.data.id, error.message),
  },
  async ({ event, step }) => {
    const { id } = event.data;
    const model = modelFor("extract");
    // Each step reads the file again and takes the same path: a PDF's text when it has a text layer, the file when it is scanned.
    const source = async (): Promise<Source> => {
      const file = await fileOf(id);
      if (!file) throw new NonRetriableError(`No document ${id} in the inbox.`);
      return (await route({ kind: "file", ...file })).source;
    };

    const ctx = { caller: "workflow", name: "document" };
    const type = await step.run("classify", () =>
      withTrace(ctx, async () => {
        const type = await classify(await source(), model);
        await updateItem(id, { type });
        return type;
      }),
    );

    const extraction = await step.run("extract", () =>
      withTrace(ctx, async () => {
        const { data, confidence, review } = await extract(
          await source(),
          schemas[type],
          model,
        );
        await updateItem(id, { status: "extracted", data, confidence, review });
        return { data, confidence, review };
      }),
    );

    let data = extraction.data;
    if (extraction.review.length > 0) {
      await step.run("ask-for-review", async () => {
        const item = await getItem(id);
        await updateItem(id, { status: "awaiting_review" });
        await notify(
          "reviewers",
          `${item?.name}: check ${extraction.review.join(", ")}`,
          "/admin/inbox",
        );
      });
      const review = await step.waitForEvent("review", {
        event: documentReviewed,
        match: "data.id",
        timeout: "3d",
      });
      if (!review) {
        await step.run("expire", () => updateItem(id, { status: "expired" }));
        return { status: "expired" };
      }
      if (review.data.decision === "rejected") {
        await step.run("reject", () => updateItem(id, { status: "rejected" }));
        return { status: "rejected" };
      }
      data = { ...data, ...review.data.data };
    }

    // The reviewer's corrections are free-form, so the merged record is
    // checked here; a bad field will not get better on a retry.
    const checked = await step.run("validate", async () => {
      const parsed = schemas[type].safeParse(data);
      if (parsed.success) return null;
      const fields = parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "record"}: ${issue.message}`,
      );
      await updateItem(id, { status: "failed", review: fields });
      return fields;
    });
    if (checked)
      throw new NonRetriableError(
        `The corrected record is invalid: ${checked.join("; ")}`,
      );

    // Filing the request is its own step, so a failure in the writes after
    // it is retried without filing a second one.
    const request = await step.run("file", async () => {
      const {
        id: requestId,
        title,
        team,
      } = await createRequest(toRequest({ type, data } as Extracted));
      return { id: requestId, title, team };
    });
    await step.run("attach", async () => {
      const item = await getItem(id);
      const existing = await getRequest(request.id);
      if (!existing)
        throw new NonRetriableError(`Request ${request.id} is gone.`);
      await saveDocument(request.id, {
        type,
        name: item?.name ?? "document",
        data,
        confidence: extraction.confidence,
        review: extraction.review,
      });
      await updateItem(id, { status: "stored", requestId: request.id, data });
    });

    await step.run("notify", async () => {
      const item = await getItem(id);
      await notify(
        "uploader",
        `${item?.name} is filed as "${request.title}" for ${request.team}.`,
        `/requests/${request.id}`,
      );
    });
    return { status: "stored", requestId: request.id };
  },
);
