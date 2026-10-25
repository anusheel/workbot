import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function budget(value: string) {
  vi.stubEnv("ALERT_DAILY_DOLLARS", value);
  vi.resetModules();
  const { config } = await import("./config");
  return config.alerts.dailyDollars;
}

test("a non-numeric budget falls back to 5 with a warning", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await budget("abc")).toBe(5);
  expect(warn).toHaveBeenCalledOnce();
});

test("a non-positive budget falls back to 5 with a warning", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await budget("0")).toBe(5);
  expect(await budget("-3")).toBe(5);
  expect(warn).toHaveBeenCalledTimes(2);
});

test("a decimal budget is used as given", async () => {
  expect(await budget("12.5")).toBe(12.5);
});

test("an unset budget is 5 without a warning", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await budget("")).toBe(5);
  expect(warn).not.toHaveBeenCalled();
});
