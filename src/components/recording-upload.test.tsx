import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecordingUpload } from "./recording-upload";

test("offers to attach a recording through a hidden file input", () => {
  const html = renderToStaticMarkup(
    <RecordingUpload action={async () => {}} />,
  );
  expect(html).toContain('accept="video/*"');
  expect(html).toContain("Attach a recording");
});
