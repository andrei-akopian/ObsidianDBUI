import test from "node:test";
import assert from "node:assert/strict";
import { toBool, toNumeric, ValueProcessor, getRowValue } from "../src/data/value-processor";
import { FilterRule, StatusOption } from "../src/types";

test("toBool converts truthy and falsy representations strictly", () => {
  assert.equal(toBool(true), true);
  assert.equal(toBool("true"), true);
  assert.equal(toBool("True"), true);
  assert.equal(toBool(1), true);
  assert.equal(toBool("1"), true);

  // Critical bug #10: "false" must be FALSE
  assert.equal(toBool("false"), false);
  assert.equal(toBool("False"), false);
  assert.equal(toBool(false), false);
  assert.equal(toBool(0), false);
  assert.equal(toBool("0"), false);
  assert.equal(toBool(""), false);
  assert.equal(toBool(null), false);
  assert.equal(toBool(undefined), false);
  assert.equal(toBool("hello"), false);
});

test("toNumeric parses numbers and formatted strings, rejecting invalid values", () => {
  assert.equal(toNumeric(42), 42);
  assert.equal(toNumeric("42"), 42);
  assert.equal(toNumeric("1,000"), 1000);
  assert.equal(toNumeric("$50.25"), 50.25);
  assert.equal(toNumeric(0), 0);
  assert.equal(toNumeric(-15.5), -15.5);

  assert.equal(toNumeric(true), null);
  assert.equal(toNumeric(false), null);
  assert.equal(toNumeric("~5"), null);
  assert.equal(toNumeric("abc"), null);
  assert.equal(toNumeric(""), null);
  assert.equal(toNumeric(null), null);
});

test("getRowValue handles original and case-insensitive keys", () => {
  const rowValues = {
    Author: "Tolkien",
    author: "Tolkien",
    "file.name": "Lord of the Rings",
  };
  assert.equal(getRowValue(rowValues, "Author"), "Tolkien");
  assert.equal(getRowValue(rowValues, "author"), "Tolkien");
  assert.equal(getRowValue(rowValues, "file.name"), "Lord of the Rings");
  assert.equal(getRowValue(rowValues, "NonExistent"), undefined);
});

test("ValueProcessor.compare: Number sorting", () => {
  assert.ok(ValueProcessor.compare(10, 2, "number") > 0);
  assert.ok(ValueProcessor.compare(2, 10, "number") < 0);
  assert.equal(ValueProcessor.compare(5, 5, "number"), 0);

  // Nulls sort to the bottom
  assert.ok(ValueProcessor.compare(null, 5, "number") > 0);
  assert.ok(ValueProcessor.compare(5, null, "number") < 0);
  assert.equal(ValueProcessor.compare(null, null, "number"), 0);
});

test("ValueProcessor.compare: Checkbox sorting", () => {
  // Checked (true) sorts before Unchecked (false) in asc
  assert.ok(ValueProcessor.compare(true, false, "checkbox") > 0);
  assert.ok(ValueProcessor.compare(false, true, "checkbox") < 0);
  assert.equal(ValueProcessor.compare("true", true, "checkbox"), 0);
  assert.equal(ValueProcessor.compare("false", false, "checkbox"), 0);
});

test("ValueProcessor.compare: Date sorting", () => {
  const early = "2024-01-01";
  const late = "2024-06-01";
  assert.ok(ValueProcessor.compare(early, late, "date") < 0);
  assert.ok(ValueProcessor.compare(late, early, "date") > 0);
  assert.equal(ValueProcessor.compare(early, early, "date"), 0);

  // Non-date strings don't crash and compare alphabetically
  assert.ok(ValueProcessor.compare("A-1", "B-1", "text") < 0);
});

test("ValueProcessor.compare: Status order pipeline sorting", () => {
  const options: StatusOption[] = [
    { id: "1", label: "To Do", color: "" },
    { id: "2", label: "In Progress", color: "" },
    { id: "3", label: "Done", color: "" },
  ];
  assert.ok(ValueProcessor.compare("To Do", "Done", "status", options) < 0);
  assert.ok(ValueProcessor.compare("In Progress", "To Do", "status", options) > 0);
  assert.equal(ValueProcessor.compare("Done", "Done", "status", options), 0);
});

test("ValueProcessor.matches: Number filters", () => {
  const equals5: FilterRule = { id: "1", key: "rating", operator: "equals", value: 5 };
  const greater5: FilterRule = { id: "2", key: "rating", operator: "greater", value: 5 };

  // Critical bug #1: Number filter = 5 does NOT match 0, 10, or arbitrary values
  assert.equal(ValueProcessor.matches(5, equals5, "number"), true);
  assert.equal(ValueProcessor.matches(10, equals5, "number"), false);
  assert.equal(ValueProcessor.matches(0, equals5, "number"), false);

  assert.equal(ValueProcessor.matches(10, greater5, "number"), true);
  assert.equal(ValueProcessor.matches(5, greater5, "number"), false);
  assert.equal(ValueProcessor.matches(2, greater5, "number"), false);

  // Unconfigured filter with empty target passes rows
  const emptyValFilter: FilterRule = { id: "3", key: "rating", operator: "equals", value: "" };
  assert.equal(ValueProcessor.matches(10, emptyValFilter, "number"), true);
  assert.equal(ValueProcessor.matches(0, emptyValFilter, "number"), true);
});

test("ValueProcessor.matches: Checkbox filters", () => {
  const isChecked: FilterRule = { id: "1", key: "done", operator: "is-checked", value: null };
  const isUnchecked: FilterRule = { id: "2", key: "done", operator: "is-unchecked", value: null };

  assert.equal(ValueProcessor.matches(true, isChecked, "checkbox"), true);
  assert.equal(ValueProcessor.matches("true", isChecked, "checkbox"), true);
  assert.equal(ValueProcessor.matches(false, isChecked, "checkbox"), false);
  assert.equal(ValueProcessor.matches("false", isChecked, "checkbox"), false);

  assert.equal(ValueProcessor.matches(false, isUnchecked, "checkbox"), true);
  assert.equal(ValueProcessor.matches("false", isUnchecked, "checkbox"), true);
  assert.equal(ValueProcessor.matches(true, isUnchecked, "checkbox"), false);
  assert.equal(ValueProcessor.matches("true", isUnchecked, "checkbox"), false);
});

test("ValueProcessor.matches: Tag list exact matching", () => {
  const equalsArt: FilterRule = { id: "1", key: "tags", operator: "equals", value: "art" };
  const containsArt: FilterRule = { id: "2", key: "tags", operator: "contains", value: "art" };

  // Critical bug #100: equals on tag list must NOT match "party"
  assert.equal(ValueProcessor.matches(["art", "design"], equalsArt, "multi-tag"), true);
  assert.equal(ValueProcessor.matches(["party", "music"], equalsArt, "multi-tag"), false);

  // contains DOES match "party" because party contains "art"
  assert.equal(ValueProcessor.matches(["party", "music"], containsArt, "multi-tag"), true);
});

test("ValueProcessor.matches: Text filter matching", () => {
  const isBook2: FilterRule = { id: "1", key: "title", operator: "equals", value: "Book 2" };

  // Critical bug #1 & #20: is "Book 2" must NOT match "Vol 2"
  assert.equal(ValueProcessor.matches("Book 2", isBook2, "text"), true);
  assert.equal(ValueProcessor.matches("Vol 2", isBook2, "text"), false);
  assert.equal(ValueProcessor.matches("Book 1", isBook2, "text"), false);
});
