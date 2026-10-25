import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DocumentFields, show } from "./document-fields";

test("shows a record field by field, lists on lines, and marks the fields to check", () => {
  const html = renderToStaticMarkup(
    <DocumentFields
      data={{
        vendor: "Acme Supplies",
        due: null,
        lines: [{ description: "Shelving", amount: 1240 }],
        unitPrice: 310,
      }}
      order={["vendor", "due", "lines", "unitPrice"]}
      review={["due"]}
    />,
  );
  expect(html).toContain("Acme Supplies");
  expect(html.indexOf("Vendor")).toBeLessThan(html.indexOf("Due"));
  expect(html).toContain("Description: Shelving, Amount: 1240");
  expect(html).toContain("Unit Price");
  expect(html.match(/>Check</g)).toHaveLength(1);
  expect(show([])).toBe("—");
  expect(show(["a", "b"])).toBe("a\nb");
});
