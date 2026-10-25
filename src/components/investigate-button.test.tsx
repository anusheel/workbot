import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { InvestigateButton } from "./investigate-button";

const noop = async () => {};

test("offers to investigate, or to investigate again when a report exists", () => {
  expect(
    renderToStaticMarkup(
      <form>
        <InvestigateButton action={noop} again={false} />
      </form>,
    ),
  ).toContain(">Investigate<");
  expect(
    renderToStaticMarkup(
      <form>
        <InvestigateButton action={noop} again={true} />
      </form>,
    ),
  ).toContain("Investigate again");
});
