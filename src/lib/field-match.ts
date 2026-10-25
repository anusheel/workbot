export const normal = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * A field is right when what was extracted carries what was expected: a
 * string contains the expected text, case and spacing aside; a list holds
 * every expected item; a record every expected field; a number is equal.
 */
export function same(got: unknown, want: unknown): boolean {
  if (Array.isArray(want))
    return Array.isArray(got) && want.every((w) => got.some((g) => same(g, w)));
  if (want && typeof want === "object")
    return (
      !!got &&
      typeof got === "object" &&
      Object.entries(want).every(([k, w]) =>
        same((got as Record<string, unknown>)[k], w),
      )
    );
  if (typeof want === "string" && typeof got === "string")
    return normal(got).includes(normal(want));
  return got === want;
}
