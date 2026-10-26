import { afterEach, expect, test, vi } from "vitest";
import { reconnecting } from "./socket";

class FakeSocket {
  static opened: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onclose?: () => void;
  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeSocket.opened = [];
});

test("opens the same address again after a close, until stopped", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
  const messages: string[] = [];
  const line = reconnecting("ws://rt/?call=c1", {
    message: (data) => messages.push(data),
  });
  const [first] = FakeSocket.opened;
  first.readyState = FakeSocket.OPEN;
  first.onmessage?.({ data: "hello" });
  line.send("one");

  first.close();
  line.send("dropped while down");
  vi.advanceTimersByTime(2000);
  const second = FakeSocket.opened[1];
  expect(second.url).toBe("ws://rt/?call=c1");
  second.readyState = FakeSocket.OPEN;
  line.send("two");

  line.stop();
  vi.advanceTimersByTime(10_000);
  expect(FakeSocket.opened).toHaveLength(2);
  expect(messages).toEqual(["hello"]);
  expect(first.sent).toEqual(["one"]);
  expect(second.sent).toEqual(["two"]);
});
