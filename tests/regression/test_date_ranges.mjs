import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customDateRange, dateRangeError, formatDayLabel, getDateRange, getLastMonthRange, manilaDate, reportRangeError,
} from "../../frontend/src/lib/dateRanges.ts";

for (const [period, instant, from, to] of [
  ["today", "2024-02-29T15:59:00Z", "2024-02-29", "2024-02-29"],
  ["today", "2024-02-29T16:00:00Z", "2024-03-01", "2024-03-01"],
  ["this_month", "2024-02-29T15:59:00Z", "2024-02-01", "2024-02-29"],
  ["this_month", "2024-02-29T16:00:00Z", "2024-03-01", "2024-03-01"],
  ["this_week", "2024-03-10T15:59:00Z", "2024-03-04", "2024-03-10"],
  ["this_week", "2024-03-10T16:00:00Z", "2024-03-11", "2024-03-11"],
  ["this_week", "2023-12-31T16:00:00Z", "2024-01-01", "2024-01-01"],
  ["this_quarter", "2024-03-31T15:59:00Z", "2024-01-01", "2024-03-31"],
  ["this_quarter", "2024-03-31T16:00:00Z", "2024-04-01", "2024-04-01"],
  ["this_year", "2024-12-31T15:59:00Z", "2024-01-01", "2024-12-31"],
  ["this_year", "2024-12-31T16:00:00Z", "2025-01-01", "2025-01-01"],
]) {
  test(`${period} at ${instant}`, () => {
    assert.deepEqual(getDateRange(period, new Date(instant)), { date_from: from, date_to: to });
  });
}

test("custom omission preserves an open boundary and explicit equal dates are valid", () => {
  assert.deepEqual(customDateRange("", ""), {});
  assert.deepEqual(customDateRange("", "2024-02-29"), { date_to: "2024-02-29" });
  assert.deepEqual(customDateRange("2024-02-29", ""), { date_from: "2024-02-29" });
  assert.equal(dateRangeError(customDateRange("2024-02-29", "2024-02-29")), undefined);
});

test("custom malformed dates cannot broaden the query", () => {
  for (const invalid of ["0000-01-01", "2025-02-29", "2024-02-30", "2024-2-09", "2024-02-09\n", "2024-02-09T00:00:00Z", "10000-01-01"]) {
    assert.equal(dateRangeError({ date_from: invalid }), "Enter a valid start date.");
    assert.equal(dateRangeError({ date_to: invalid }), "Enter a valid end date.");
  }
  assert.equal(dateRangeError({ date_from: "0001-01-01", date_to: "9999-12-31" }), undefined);
});

test("history allows an open end while reports validate their existing defaults", () => {
  const now = new Date("2024-12-31T16:00:00Z");
  const past = customDateRange("", "2024-12-31");
  assert.equal(dateRangeError(past), undefined);
  assert.equal(reportRangeError(past, now), "The end date must be on or after the start date.");
  assert.equal(reportRangeError(customDateRange("", ""), now), undefined);
  assert.equal(dateRangeError(customDateRange("2025-01-01", "2024-12-31")), "The end date must be on or after the start date.");
});

test("history labels use the same Manila calendar even across year and leap-day boundaries", () => {
  const newYear = manilaDate(new Date("2024-12-31T16:00:00Z"));
  assert.equal(formatDayLabel("2025-01-01", newYear), "Today");
  assert.equal(formatDayLabel("2024-12-31", newYear), "Yesterday");
  assert.equal(formatDayLabel("2024-02-29", "2024-03-01"), "Yesterday");
});

test("last month covers the whole previous Manila calendar month", () => {
  assert.deepEqual(getLastMonthRange(new Date("2024-03-15T03:00:00Z")), { date_from: "2024-02-01", date_to: "2024-02-29" });
  assert.deepEqual(getLastMonthRange(new Date("2025-01-01T16:30:00Z")), { date_from: "2024-12-01", date_to: "2024-12-31" });
});
