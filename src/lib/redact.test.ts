import { expect, test } from "vitest";
import { redact } from "./redact";

test.each([
  [
    "Write to dana.whitfield@brightline-retail.example today",
    "Write to [email] today",
  ],
  ["Call (510) 555-0142 or +1 510 555 0142", "Call [phone] or [phone]"],
  ["Card 4111 1111 1111 1111 declined", "Card [card] declined"],
  ["SSN 123-45-6789 on file", "SSN [ssn] on file"],
  ["key sk-ant-api03-abcdefghijklmnop rejected", "key [secret] rejected"],
  [
    "token ghp_abcdefghijklmnopqrstuvwxyz0123 expired",
    "token [secret] expired",
  ],
  [
    "Authorization: Bearer wb_abcdefghijklmnopqrstuvwxyz",
    "Authorization: [secret]",
  ],
])("%s", (input, output) => {
  expect(redact(input)).toBe(output);
});

test("an order number, an invoice number and an amount survive", () => {
  const text =
    "Order 4411, invoice INV-48213, total $7,200.00, PO 1234567890123";
  expect(redact(text)).toBe(text);
});
