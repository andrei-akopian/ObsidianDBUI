import test from "node:test";
import assert from "node:assert/strict";
import { VaultScanner } from "../src/data/vault-scanner";
import { ColumnConfig, RowData } from "../src/types";

test("VaultScanner.inferDataType: whole word matching and strict types", () => {
  const scanner = new VaultScanner({} as any);

  // Critical bug #120: vintage, percentage must NOT be inferred as multi-tag
  assert.equal(scanner.inferDataType("1998", "vintage"), "number");
  assert.equal(scanner.inferDataType(95, "percentage"), "number");
  assert.equal(scanner.inferDataType("cool", "vintage_description"), "text");

  // Critical bug #120: candidate, created_by must NOT be inferred as date
  assert.equal(scanner.inferDataType("John Doe", "candidate"), "text");
  assert.equal(scanner.inferDataType("Andrei", "created_by"), "text");

  // Legitimate tags and dates
  assert.equal(scanner.inferDataType(["fiction"], "genre"), "multi-tag");
  assert.equal(scanner.inferDataType(["js", "ts"], "tags"), "multi-tag");
  assert.equal(scanner.inferDataType("2024-01-01", "created_at"), "date");
  assert.equal(scanner.inferDataType("2024-01-01", "deadline"), "date");
  assert.equal(scanner.inferDataType("2024-01-01", "publish_date"), "date");

  // Values
  assert.equal(scanner.inferDataType("true", "is_active"), "checkbox");
  assert.equal(scanner.inferDataType(true, "flag"), "checkbox");
  assert.equal(scanner.inferDataType(42, "count"), "number");
  assert.equal(scanner.inferDataType("1,000", "price"), "number");

  // Critical bug #1 & #21: "Book 2" must NOT be inferred as date
  assert.equal(scanner.inferDataType("Book 2", "title"), "text");
  assert.equal(scanner.inferDataType("Chapter 1", "chapter"), "text");
  assert.equal(scanner.inferDataType("5", "volume"), "number");
});

test("VaultScanner.discoverColumns respects removedKeys", () => {
  const scanner = new VaultScanner({} as any);
  const rows: RowData[] = [
    {
      file: {} as any,
      basename: "Note 1",
      path: "Note 1.md",
      values: {
        "file.name": "Note 1",
        rating: 5,
        review: "Great book",
        genre: ["Sci-Fi"],
      },
    },
  ];

  const existingColumns: ColumnConfig[] = [
    { key: "file.name", name: "Name", type: "file", width: 220, visible: true },
    { key: "genre", name: "Genre", type: "multi-tag", width: 160, visible: true },
  ];

  // Critical bug #8: "rating" was removed by user, so it must NOT be re-added
  const removedKeys = ["rating"];
  const discovered = scanner.discoverColumns(rows, existingColumns, removedKeys);

  const keys = discovered.map((c) => c.key.toLowerCase());
  assert.ok(keys.includes("file.name"));
  assert.ok(keys.includes("genre"));
  assert.ok(keys.includes("review"));
  assert.ok(!keys.includes("rating"), "Removed key 'rating' must not be auto-discovered again!");
});
