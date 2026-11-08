import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDate,
  formatAbsoluteDate,
  formatRelativeDate,
  isDateInPast,
  isDateInFuture,
  isDateToday,
} from "../src/utils/date-utils.ts";

test("parseDate strictly parses ISO dates", () => {
  const d1 = parseDate("2024-05-10");
  assert.ok(d1 !== null);
  assert.equal(d1.getFullYear(), 2024);
  assert.equal(d1.getMonth(), 4);
  assert.equal(d1.getDate(), 10);

  const d2 = parseDate("2024-12-31T23:59:00");
  assert.ok(d2 !== null);
  assert.equal(d2.getHours(), 23);
  assert.equal(d2.getMinutes(), 59);
});

test("parseDate strictly rejects numbers and arbitrary non-date strings", () => {
  // Critical bug #1: V8 accepts "5", "Book 2", "Chapter 1", numbers
  assert.equal(parseDate(5), null);
  assert.equal(parseDate(1700000000), null);
  assert.equal(parseDate("5"), null);
  assert.equal(parseDate("Book 2"), null);
  assert.equal(parseDate("Chapter 1"), null);
  assert.equal(parseDate("A-1"), null);
  assert.equal(parseDate("Vol 2"), null);
  assert.equal(parseDate("random text"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(undefined), null);
  // Invalid calendar dates
  assert.equal(parseDate("2024-02-31"), null);
  assert.equal(parseDate("2024-13-01"), null);
});

test("formatAbsoluteDate formats ISO date and datetime preserving 00:00", () => {
  const d = new Date(2024, 0, 5, 0, 0, 0);
  assert.equal(formatAbsoluteDate(d, false), "2024-01-05");
  // includeTime must include T00:00
  assert.equal(formatAbsoluteDate(d, true), "2024-01-05T00:00");

  const d2 = new Date(2024, 11, 25, 14, 30, 0);
  assert.equal(formatAbsoluteDate(d2, true), "2024-12-25T14:30");
});

test("relative date calculations", () => {
  const now = new Date(2024, 5, 15, 12, 0, 0);
  const today = new Date(2024, 5, 15, 8, 0, 0);
  const tomorrow = new Date(2024, 5, 16, 8, 0, 0);
  const yesterday = new Date(2024, 5, 14, 8, 0, 0);

  assert.equal(formatRelativeDate(today, now), "Today");
  assert.equal(formatRelativeDate(tomorrow, now), "Tomorrow");
  assert.equal(formatRelativeDate(yesterday, now), "Yesterday");

  assert.equal(isDateToday(today, now), true);
  assert.equal(isDateInFuture(tomorrow, now), true);
  assert.equal(isDateInPast(yesterday, now), true);
});
