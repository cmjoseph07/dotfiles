import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codeIn, namesMod } from "../../upstream/drift.js";

// This mod is the shipped spaces sidebar with its own changes, carried by hand at each
// uptake. Taken code names this mod where Herdr's names the shipped one, in every file the
// mod runs: a shipped name left in opens or reads the shipped sidebar, and nothing else
// says so. Its tests are left out: they may read a snapshot, under the shipped name. codeIn
// lists the folder as drift lists a mod folder, never walking into a link, and reads only
// regular files.
const code = codeIn(import.meta.dirname);

// The checks below pass on a scan that read nothing: this one shows it read the mod.
test("the scan reads main.js, the file this mod runs", () => {
  assert.ok(code.some(({ file }) => file === "main.js"), `the scan read ${code.length} files, not main.js`);
});

// What is not a regular file is listed unread, whatever its name: the scan cannot say what it names.
test("every file this mod could run is a file the scan read", () => {
  assert.deepEqual(code.filter(({ text }) => text === null).map(({ file }) => file), []);
});

// The shipped mod this one stands in for, as mod.clone recorded it: never typed here.
const shipped = JSON.parse(readFileSync(new URL("./mod.json", import.meta.url), "utf8")).cloned_from.name;

test(`no file this mod runs names the shipped mod it was cloned from, ${shipped}`, () => {
  const names = namesMod(shipped);
  assert.deepEqual(code.filter(({ text }) => names.test(text)).map(({ file }) => file), []);
});
