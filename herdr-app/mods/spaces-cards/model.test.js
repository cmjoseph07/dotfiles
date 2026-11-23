import { test } from "node:test";
import assert from "node:assert/strict";
import { readableBranch } from "./model.js";

test("readableBranch drops the prefix and reads as a sentence", () => {
  assert.equal(readableBranch("feat/analyze-in-daemon"), "Analyze in daemon");
  assert.equal(readableBranch("fix/ui/long_branch-name"), "Long branch name");
  assert.equal(readableBranch("main"), "Main");
});

test("readableBranch keeps a branch that has no readable leaf", () => {
  assert.equal(readableBranch("feat/"), "feat/");
  assert.equal(readableBranch("--"), "--");
});
