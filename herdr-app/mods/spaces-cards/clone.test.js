import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filesBelow, namesMod } from "../../upstream/drift.js";

// This mod is the shipped spaces sidebar with its own changes, carried by hand at each
// uptake. Taken code names this mod where Herdr's names the shipped one, in every file the
// mod runs: a shipped name left in opens or reads the shipped sidebar, and nothing else
// says so. Its tests are left out: they may read a snapshot, under the shipped name. The
// folder is listed as drift lists a mod folder: a link is a name, never walked into.
const code = filesBelow(import.meta.dirname)
  .filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))
  .map((file) => ({ file, text: readFileSync(join(import.meta.dirname, file), "utf8") }));

// The checks below pass on a scan that read nothing: this one shows it read the mod.
test("the scan reads main.js, the file this mod runs", () => {
  assert.ok(code.some(({ file }) => file === "main.js"), `the scan read ${code.length} files, not main.js`);
});

test("no file this mod runs names the shipped spaces sidebar", () => {
  assert.deepEqual(code.filter(({ text }) => namesMod("spaces").test(text)).map(({ file }) => file), []);
});
