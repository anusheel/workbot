import { describe, expect, it } from "vitest";
import { errorText } from "./chat";

describe("errorText", () => {
  it("returns the error field of a JSON body", () => {
    const body = JSON.stringify({ error: "Too many messages." });
    expect(errorText(new Error(body))).toBe("Too many messages.");
  });

  it("returns the message as is when the body is not JSON", () => {
    expect(errorText(new Error("Bad gateway"))).toBe("Bad gateway");
  });

  it("returns the message when the JSON has no error field", () => {
    expect(errorText(new Error('{"ok":false}'))).toBe('{"ok":false}');
  });
});
