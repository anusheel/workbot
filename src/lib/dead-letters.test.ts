import { expect, test } from "vitest";
import { deadLetter, listDeadLetters } from "./dead-letters";
import { receive } from "./inbox";

test("a letter names the document its event carried", async () => {
  const item = await receive(
    "invoice-9.txt",
    "text/plain",
    new TextEncoder().encode("Invoice 9: $120 for pallets"),
    "acme",
  );
  await deadLetter(
    "job:document",
    "acme",
    { name: "document/received", data: { id: item.id, owner: "acme" } },
    "The PDF specified was not valid.",
  );
  const [letter] = await listDeadLetters(1);
  expect(letter.document).toBe("invoice-9.txt");
});
