import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FileUpload } from "./file-upload";

test("offers the file through a hidden input and a button", () => {
  const html = renderToStaticMarkup(
    <FileUpload
      action={async () => {}}
      name="recording"
      accept="video/*"
      label="Attach a recording"
      busy="Reading…"
      icon={<span data-icon />}
    />,
  );
  expect(html).toContain('accept="video/*"');
  expect(html).toContain('name="recording"');
  expect(html).toContain("Attach a recording");
});
