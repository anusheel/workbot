/**
 * Personal data and secrets out of a string before it is logged or traced:
 * an email, a phone number, a payment card (by its checksum, so an order
 * number survives), a US social security number, and the keys and tokens
 * this app and its providers use. What is kept is the label, so a trace
 * still says what kind of thing was there.
 */
const patterns: [RegExp, string][] = [
  [
    /\b(?:sk-ant-[\w-]+|gh[pousr]_\w{20,}|github_pat_\w{20,}|w[bs]_[\w-]{20,}|Bearer\s+[\w.-]{16,})/g,
    "[secret]",
  ],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]"],
  [/\b\d(?:[ -]?\d){12,18}\b/g, "[card]"],
  [/(?<![\w+])(?:\+\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g, "[phone]"],
];

/** The Luhn checksum every payment card number passes and most other long numbers fail. */
function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

export function redact(text: string): string {
  return patterns.reduce(
    (out, [pattern, label]) =>
      out.replace(pattern, (match) =>
        label === "[card]" && !luhn(match.replace(/\D/g, "")) ? match : label,
      ),
    text,
  );
}
