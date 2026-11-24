import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filesBelow, namesMod } from "../../upstream/drift.js";

// This mod is the shipped agents list with its own changes, merged at each uptake: these read
// it, and the snapshot of the version it was last merged with, as text.
const lines = (path) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n");
const clone = lines("./main.js");
const snapshot = lines("../../upstream/mods/agents/main.js");

// The one line of a file that `holds` picks. A line that is gone or doubled is a rule that
// moved: a rule to look at.
const one = (file, holds) => {
  const found = file.filter(holds);
  assert.equal(found.length, 1, `${found.length} lines match, not 1`);
  return found[0];
};
const cleanLine = (line) => line.startsWith("const clean =");
const pathLine = (line) => line.trimStart().startsWith("const path =") && line.includes(".test(");

// spaces-cards ties its title rule to these two lines, and these tie them to the snapshot:
// an uptake that moves the snapshots without merging is red.
test("the clone's const clean = line is the snapshot's", () => {
  assert.equal(one(clone, cleanLine), one(snapshot, cleanLine));
});

test("the clone's const path = line that tests the title is the snapshot's", () => {
  assert.equal(one(clone, pathLine), one(snapshot, pathLine));
});

// mod.clone renamed the sort menu's overlay to this mod. A merge that takes the shipped name
// back opens the shipped agents list's menu, with no conflict to say so.
test("every line that opens the sort menu opens this mod", () => {
  const opens = clone.filter((line) => line.includes("sortMenu: true"));
  assert.notEqual(opens.length, 0, "no line opens the sort menu");
  for (const line of opens) assert.ok(line.includes('mod: "agents-context"'), `the sort menu does not open this mod: ${line.trim()}`);
});

// Taken code names this mod where Herdr's names the shipped one, in every file the mod runs.
// Its tests are left out: they read the snapshot, under the shipped name. The folder is
// listed as drift lists a mod folder: a link is a name, never walked into.
const code = filesBelow(import.meta.dirname)
  .filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))
  .map((file) => ({ file, text: readFileSync(join(import.meta.dirname, file), "utf8") }));

// The checks below pass on a scan that read nothing: this one shows it read the mod.
test("the scan reads main.js, the file this mod runs", () => {
  assert.ok(code.some(({ file }) => file === "main.js"), `the scan read ${code.length} files, not main.js`);
});

test("no file this mod runs names the shipped agents list", () => {
  assert.deepEqual(code.filter(({ text }) => namesMod("agents").test(text)).map(({ file }) => file), []);
});
