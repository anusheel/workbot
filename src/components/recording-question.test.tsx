import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecordingQuestion } from "./recording-question";

test("offers a question box for the recording", () => {
  const html = renderToStaticMarkup(
    <RecordingQuestion action={async () => ({})} />,
  );
  expect(html).toContain('placeholder="Ask about this recording"');
  expect(html).toContain(">Ask<");
});
