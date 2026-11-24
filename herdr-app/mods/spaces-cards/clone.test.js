import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// This mod is the shipped spaces sidebar with its own changes, carried by hand at each
// uptake. Taken code names this mod where Herdr's names the shipped one, in every file the
// mod runs: a shipped name left in opens or reads the shipped sidebar, and nothing else
// says so. Its tests are left out: they may read a snapshot, under the shipped name.
const code = readdirSync(new URL(".", import.meta.url), { recursive: true })
  .filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))
  .map((file) => ({ file, text: readFileSync(new URL(file, import.meta.url), "utf8") }));

for (const shipped of ['mod: "spaces"', "mods/spaces/"]) {
  test(`no file this mod runs names the shipped spaces sidebar: ${shipped}`, () => {
    assert.deepEqual(code.filter(({ text }) => text.includes(shipped)).map(({ file }) => file), []);
  });
}
