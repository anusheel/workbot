/** Evaluates arithmetic: decimal numbers, + - * / % ^, parentheses and unary minus. */
export function calculate(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[-+*/%^()]/g) ?? [];
  if (tokens.join("") !== expression.replace(/\s+/g, ""))
    throw new Error(`Cannot read "${expression}"`);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const sum = (): number => {
    let value = product();
    while (peek() === "+" || peek() === "-")
      value = next() === "+" ? value + product() : value - product();
    return value;
  };
  const product = (): number => {
    let value = unary();
    for (;;) {
      if (peek() === "*") value *= (next(), unary());
      else if (peek() === "/") value /= (next(), unary());
      else if (peek() === "%") value %= (next(), unary());
      else return value;
    }
  };
  // Negation applies to the whole power, so -3 ^ 2 is -9, as in mathematics.
  const unary = (): number => (peek() === "-" ? (next(), -unary()) : power());
  const power = (): number => {
    const base = primary();
    return peek() === "^" ? (next(), base ** unary()) : base;
  };
  const primary = (): number => {
    const token = next();
    if (token === "(") {
      const value = sum();
      if (next() !== ")") throw new Error("Missing )");
      return value;
    }
    if (token === undefined || !/^\d/.test(token))
      throw new Error(`Unexpected ${token ?? "end of expression"}`);
    return Number(token);
  };

  const value = sum();
  if (position < tokens.length)
    throw new Error(`Unexpected ${tokens[position]}`);
  if (!Number.isFinite(value))
    throw new Error("The result is not a finite number");
  return value;
}
