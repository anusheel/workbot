import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { LinkCode } from "./link-code";

test("offers a code behind one button, issued only when it is pressed", () => {
  let issued = 0;
  const html = renderToStaticMarkup(
    <LinkCode
      label="Continue on your phone"
      icon={null}
      instruction="Send this from your phone:"
      targets={[
        {
          label: "Open WhatsApp",
          href: "https://wa.me/15105550001?text={code}",
        },
      ]}
      action={async () => {
        issued++;
        return "K7QP3MXD";
      }}
    />,
  );
  expect(html).toContain(">Continue on your phone<");
  expect(html).not.toContain("Open WhatsApp");
  expect(issued).toBe(0);
});
