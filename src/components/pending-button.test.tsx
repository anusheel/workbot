import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PendingButton } from "./pending-button";

test("shows its label and icon while the form is idle", () => {
  const html = renderToStaticMarkup(
    <form>
      <PendingButton busy="Working…" icon={<span data-icon />}>
        Do it
      </PendingButton>
    </form>,
  );
  expect(html).toContain(">Do it<");
  expect(html).toContain("data-icon");
  expect(html).not.toContain("Working…");
});
