import test from "node:test";
import assert from "node:assert/strict";
import { FrontmatterManager } from "../src/data/frontmatter-manager";

test("isValidFileName rejects illegal characters and empty names", () => {
  assert.equal(FrontmatterManager.isValidFileName("Valid Note Name").valid, true);
  assert.equal(FrontmatterManager.isValidFileName("Note 123-abc_test").valid, true);

  assert.equal(FrontmatterManager.isValidFileName("").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("   ").valid, false);

  // Illegal filesystem or Obsidian link chars
  assert.equal(FrontmatterManager.isValidFileName("Folder/Note").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Folder\\Note").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Note: Part 1").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Note * 2").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("What?").valid, false);
  assert.equal(FrontmatterManager.isValidFileName('Say "Hello"').valid, false);
  assert.equal(FrontmatterManager.isValidFileName("A < B").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("A > B").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Pipe|Line").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Note#Header").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Note^Block").valid, false);
  assert.equal(FrontmatterManager.isValidFileName("Note[Link]").valid, false);
});
