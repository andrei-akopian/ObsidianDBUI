import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../src/data/config-manager";

test("normalizeConfig produces valid config from null/undefined/empty input", () => {
  const cfg1 = normalizeConfig(null);
  assert.equal(cfg1.folder, "");
  assert.equal(cfg1.includeSubfolders, true);
  assert.equal(cfg1.columns[0].key, "file.name");
  assert.equal(cfg1.columns[0].type, "file");

  const cfg2 = normalizeConfig({});
  assert.equal(cfg2.columns[0].key, "file.name");
  assert.equal(cfg2.settings.rowDensity, "compact");
});

test("normalizeConfig preserves valid columns and normalizes folder path", () => {
  const cfg = normalizeConfig({
    folder: "/Projects/Books/",
    includeSubfolders: false,
    settings: {
      rowDensity: "comfortable",
      wrapCells: true,
    },
    columns: [
      { key: "Author", name: "Author", type: "text", width: 180 },
      { key: "file.name", name: "Title", type: "file", width: 250 },
    ],
    removedKeys: ["Rating"],
  });

  // Normalizes folder by stripping leading/trailing slashes
  assert.equal(cfg.folder, "Projects/Books");
  assert.equal(cfg.includeSubfolders, false);
  assert.equal(cfg.settings.rowDensity, "comfortable");
  assert.equal(cfg.settings.wrapCells, true);

  // Ensures file.name is the first column
  assert.equal(cfg.columns[0].key, "file.name");
  assert.equal(cfg.columns[1].key, "Author");

  // Preserves removedKeys in lowercase
  assert.deepEqual(cfg.removedKeys, ["rating"]);
});

test("normalizeConfig handles invalid column data safely", () => {
  const cfg = normalizeConfig({
    columns: null,
    settings: null,
    filters: null,
    sort: null,
  });

  assert.ok(Array.isArray(cfg.columns));
  assert.equal(cfg.columns[0].key, "file.name");
  assert.ok(Array.isArray(cfg.filters));
  assert.ok(Array.isArray(cfg.sort));
});
