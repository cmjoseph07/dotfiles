import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { CLONE_OF, codeIn, drift, filesBelow, namesMod, snapshotLinks, verdict } from "./drift.js";

const SHIPPED = {
  "mods/spaces/main.js": "export default class Spaces {}\n",
  "mods/spaces/mod.json": '{ "place": "none", "title": "Spaces" }\n',
  "mods/agents/main.js": "export default class Agents {}\n",
  "mods/agents/mod.json": '{ "place": "none", "title": "Agents" }\n',
  "layouts/main.json": '{ "id": "root", "type": "row" }\n',
};
const NAME_OF = {
  "mods/spaces/main.js": "spaces",
  "mods/spaces/mod.json": "spaces",
  "mods/agents/main.js": "agents",
  "mods/agents/mod.json": "agents",
  "layouts/main.json": "main",
};
const without = (files, path) => Object.fromEntries(Object.entries(files).filter(([p]) => p !== path));
const withoutMod = (files, mod) => Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith(`mods/${mod}/`)));
// The files of one mod moved to elsewhere/<mod>, for a link where its folder was to lead to.
const movedAway = (files, mod) =>
  Object.fromEntries(Object.entries(files).map(([path, text]) => [path.startsWith(`mods/${mod}/`) ? path.replace("mods/", "elsewhere/") : path, text]));

// A snapshot folder and an app folder holding the given files, removed when the test ends.
const folders = (t, snapshotFiles, appFiles) => {
  const root = mkdtempSync(join(tmpdir(), "drift-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (folder, files) => {
    mkdirSync(folder);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(folder, path)), { recursive: true });
      writeFileSync(join(folder, path), text);
    }
    return folder;
  };
  return [write(join(root, "snapshots"), snapshotFiles), write(join(root, "app"), appFiles)];
};

test("drift reports nothing when every shipped file is its snapshot", (t) => {
  assert.deepEqual(drift(...folders(t, SHIPPED, SHIPPED)), []);
});

for (const [path, name] of Object.entries(NAME_OF)) {
  test(`drift reports ${name} alone when one byte of ${path} changed`, (t) => {
    const changed = { ...SHIPPED, [path]: SHIPPED[path].replace("o", "0") };
    assert.notEqual(changed[path], SHIPPED[path], `the change left ${path} as it was`);
    // Sizes are compared first: only a change of one size reaches the bytes.
    assert.equal(Buffer.byteLength(changed[path]), Buffer.byteLength(SHIPPED[path]), `the change moved the size of ${path}, so no byte is compared`);
    assert.deepEqual(drift(...folders(t, SHIPPED, changed)), [name]);
  });

  test(`drift reports ${name} when ${path} is shipped and has no snapshot`, (t) => {
    assert.deepEqual(drift(...folders(t, without(SHIPPED, path), SHIPPED)), [name]);
  });
}

test("drift reports all three names when there is no snapshot at all", (t) => {
  assert.deepEqual(drift(...folders(t, {}, SHIPPED)), ["spaces", "agents", "main"]);
});

for (const mod of ["spaces", "agents"]) {
  test(`drift reports ${mod} when a file was added to its shipped folder`, (t) => {
    const added = { ...SHIPPED, [`mods/${mod}/icon.svg`]: "<svg/>\n" };
    assert.deepEqual(drift(...folders(t, SHIPPED, added)), [mod]);
  });

  test(`drift reports ${mod} when a file was added below its shipped folder`, (t) => {
    const added = { ...SHIPPED, [`mods/${mod}/fonts/pixel.ttf`]: "font\n" };
    assert.deepEqual(drift(...folders(t, SHIPPED, added)), [mod]);
  });

  test(`drift reports ${mod} when a link was added to its shipped folder`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
    symlinkSync("main.js", join(app, `mods/${mod}/linked.js`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when a snapshot file is gone from its shipped folder`, (t) => {
    assert.deepEqual(drift(...folders(t, SHIPPED, without(SHIPPED, `mods/${mod}/mod.json`))), [mod]);
  });
}

test("drift reports nothing when a file below a shipped folder has its snapshot at the same path", (t) => {
  const nested = { ...SHIPPED, "mods/spaces/fonts/pixel.ttf": "font\n" };
  assert.deepEqual(drift(...folders(t, nested, nested)), []);
});

test("drift reports spaces when a file added below its shipped folder is named like one above", (t) => {
  const added = { ...SHIPPED, "mods/spaces/lib/main.js": SHIPPED["mods/spaces/main.js"] };
  assert.deepEqual(drift(...folders(t, SHIPPED, added)), ["spaces"]);
});

test("drift reports nothing for the files the app writes into a mod folder, at any depth", (t) => {
  const written = {
    ...SHIPPED,
    "mods/spaces/gpui-kit.d.ts": "declare module 'gpui-kit';\n",
    "mods/spaces/jsconfig.json": "{}\n",
    "mods/agents/gpui-kit.d.ts": "declare module 'gpui-kit';\n",
    "mods/agents/jsconfig.json": "{}\n",
    "mods/spaces/lib/gpui-kit.d.ts": "declare module 'gpui-kit';\n",
    "mods/agents/lib/jsconfig.json": "{}\n",
  };
  assert.deepEqual(drift(...folders(t, SHIPPED, written)), []);
});

test("drift reports nothing for the .DS_Store files Finder leaves in a folder it showed", (t) => {
  const shown = { "mods/spaces/.DS_Store": "finder\n", "mods/agents/fonts/.DS_Store": "finder\n" };
  assert.deepEqual(drift(...folders(t, SHIPPED, { ...SHIPPED, ...shown })), []);
  assert.deepEqual(drift(...folders(t, { ...SHIPPED, ...shown }, SHIPPED)), []);
});

test("drift reports nothing when the shipped files are absent", (t) => {
  assert.deepEqual(drift(...folders(t, SHIPPED, {})), []);
});

test("drift reports nothing for a shipped mod or layout that is absent, and still reports the others", (t) => {
  const onlyAgents = { "mods/agents/main.js": "changed\n", "mods/agents/mod.json": SHIPPED["mods/agents/mod.json"] };
  assert.deepEqual(drift(...folders(t, SHIPPED, onlyAgents)), ["agents"]);
});

// No snapshot yet is a state, not a refusal: with no shipped file to compare, nothing differs.
test("drift reports nothing for a mod with no snapshot folder whose shipped folder holds only files the app writes", (t) => {
  const written = { ...withoutMod(SHIPPED, "spaces"), "mods/spaces/gpui-kit.d.ts": "declare module 'gpui-kit';\n" };
  assert.deepEqual(drift(...folders(t, withoutMod(SHIPPED, "spaces"), written)), []);
});

for (const mod of ["spaces", "agents"]) {
  test(`drift reports ${mod} when a snapshot file's shipped path is now a folder`, (t) => {
    const folder = { ...without(SHIPPED, `mods/${mod}/mod.json`), [`mods/${mod}/mod.json/part.json`]: "{}\n" };
    assert.deepEqual(drift(...folders(t, SHIPPED, folder)), [mod]);
  });

  test(`drift reports ${mod} when a snapshot file's shipped path is now an empty folder`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, `mods/${mod}/mod.json`));
    mkdirSync(join(app, `mods/${mod}/mod.json`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when a shipped file's snapshot path is a folder`, (t) => {
    const [snapshots, app] = folders(t, without(SHIPPED, `mods/${mod}/mod.json`), SHIPPED);
    mkdirSync(join(snapshots, `mods/${mod}/mod.json`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });
}

test("drift reports main when a link that leads nowhere is where the shipped layouts/main.json was", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, "layouts/main.json"));
  mkdirSync(join(app, "layouts"));
  symlinkSync("gone.json", join(app, "layouts/main.json"));
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

for (const mod of ["spaces", "agents"]) {
  test(`drift reports ${mod} when a link that leads nowhere is where its shipped folder was`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, withoutMod(SHIPPED, mod));
    symlinkSync("gone", join(app, `mods/${mod}`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  // Walked into, the link would show the snapshot's files, each the same.
  test(`drift reports ${mod} when its shipped folder is a link to a folder holding the same files`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, movedAway(SHIPPED, mod));
    symlinkSync(`../elsewhere/${mod}`, join(app, `mods/${mod}`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when its snapshot folder is a link to a folder holding the same files`, (t) => {
    const [snapshots, app] = folders(t, movedAway(SHIPPED, mod), SHIPPED);
    symlinkSync(`../elsewhere/${mod}`, join(snapshots, `mods/${mod}`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  // Only a real folder is a mod folder: what is there instead differs, whatever it holds.
  test(`drift reports ${mod} when its folder is, on both sides, a link to one same file`, (t) => {
    const [snapshots, app] = folders(t, withoutMod(SHIPPED, mod), withoutMod(SHIPPED, mod));
    const one = join(dirname(snapshots), "one.js");
    writeFileSync(one, SHIPPED[`mods/${mod}/main.js`]);
    for (const side of [snapshots, app]) symlinkSync(one, join(side, `mods/${mod}`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when its folder is, on both sides, a file of the same bytes`, (t) => {
    const [snapshots, app] = folders(t, withoutMod(SHIPPED, mod), withoutMod(SHIPPED, mod));
    for (const side of [snapshots, app]) writeFileSync(join(side, `mods/${mod}`), SHIPPED[`mods/${mod}/main.js`]);
    assert.deepEqual(drift(snapshots, app), [mod]);
  });
}

// mods and layouts are only the way to a name: a link there is followed, on either side, and
// what it leads to is compared as if it were there.
const CHANGED_BELOW = { mods: "mods/agents/main.js", layouts: "layouts/main.json" };
// The shipped files on both sides, with one side's top folder moved to elsewhere/ and a link
// where it was; that side's folder is returned last.
const linkedAbove = (t, top, side) => {
  const moved = Object.fromEntries(Object.entries(SHIPPED).map(([path, text]) => [path.startsWith(`${top}/`) ? `elsewhere/${path}` : path, text]));
  const [snapshots, app] = side === "snapshot" ? folders(t, moved, SHIPPED) : folders(t, SHIPPED, moved);
  const linked = side === "snapshot" ? snapshots : app;
  symlinkSync(`elsewhere/${top}`, join(linked, top));
  return [snapshots, app, linked];
};
for (const side of ["snapshot", "shipped"]) {
  for (const top of Object.keys(CHANGED_BELOW)) {
    test(`drift follows a link where the ${side} ${top} folder was`, (t) => {
      const [snapshots, app, linked] = linkedAbove(t, top, side);
      assert.deepEqual(drift(snapshots, app), [], "the link alone was reported");
      writeFileSync(join(linked, "elsewhere", CHANGED_BELOW[top]), "changed\n");
      assert.deepEqual(drift(snapshots, app), [NAME_OF[CHANGED_BELOW[top]]], "a change behind the link went unseen");
    });
  }

  test(`drift lists a mod folder behind a link where the ${side} mods folder was`, (t) => {
    const [snapshots, app, linked] = linkedAbove(t, "mods", side);
    writeFileSync(join(linked, "elsewhere/mods/agents/added.js"), "");
    assert.deepEqual(drift(snapshots, app), ["agents"]);
  });
}

// The file system will not look below a file: that is not a name that is absent.
test("drift reports main when the shipped layouts folder is a file", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, "layouts/main.json"));
  writeFileSync(join(app, "layouts"), "{}\n");
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

test("drift reports both mods when the shipped mods folder is a file", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, { "layouts/main.json": SHIPPED["layouts/main.json"] });
  writeFileSync(join(app, "mods"), "{}\n");
  assert.deepEqual(drift(snapshots, app), ["spaces", "agents"]);
});

test("drift reports main when layouts/main.json is shipped as a folder", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, "layouts/main.json"));
  mkdirSync(join(app, "layouts/main.json"), { recursive: true });
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

test("drift reports main when the snapshot path of layouts/main.json is a folder", (t) => {
  const [snapshots, app] = folders(t, without(SHIPPED, "layouts/main.json"), SHIPPED);
  mkdirSync(join(snapshots, "layouts/main.json"), { recursive: true });
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

// Node reads no file over 2 GiB whole. The file is sparse: it takes no room on the disk.
test("drift reports spaces, and does not throw, when a shipped file is over 2 GiB", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  truncateSync(join(app, "mods/spaces/main.js"), 2 ** 31 + 1);
  assert.deepEqual(drift(snapshots, app), ["spaces"]);
});

// A function of drift.js in a process of its own, ended if it has not answered in 5 seconds:
// nothing in this process could end a read of a pipe, which waits for a writer, or a walk that
// never ends.
const alone = (name, ...args) => {
  const script = `import { ${name} } from ${JSON.stringify(import.meta.resolve("./drift.js"))};
console.log(JSON.stringify(${name}(...${JSON.stringify(args)})));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8", timeout: 5000 });
  assert.equal(run.signal, null, `${name} did not answer in 5 seconds`);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};
const driftAlone = (snapshots, app) => alone("drift", snapshots, app);

// The other side is an empty file, so the sizes alone cannot tell it from the pipe.
const emptied = { ...SHIPPED, "mods/spaces/main.js": "" };

test("drift reports spaces without waiting when a shipped file is now a pipe", (t) => {
  const [snapshots, app] = folders(t, emptied, without(SHIPPED, "mods/spaces/main.js"));
  execFileSync("mkfifo", [join(app, "mods/spaces/main.js")]);
  assert.deepEqual(driftAlone(snapshots, app), ["spaces"]);
});

test("drift reports spaces without waiting when a snapshot file is a pipe", (t) => {
  const [snapshots, app] = folders(t, without(SHIPPED, "mods/spaces/main.js"), emptied);
  execFileSync("mkfifo", [join(snapshots, "mods/spaces/main.js")]);
  assert.deepEqual(driftAlone(snapshots, app), ["spaces"]);
});

// Walked into, the link would show the snapshot's files, each the same.
test("drift reports spaces when a folder of it is now a link to a folder holding the same files", (t) => {
  const nested = { ...SHIPPED, "mods/spaces/fonts/pixel.ttf": "font\n" };
  const [snapshots, app] = folders(t, nested, { ...SHIPPED, "elsewhere/fonts/pixel.ttf": "font\n" });
  symlinkSync("../../elsewhere/fonts", join(app, "mods/spaces/fonts"));
  assert.deepEqual(drift(snapshots, app), ["spaces"]);
});

// Walked into, two links back to their own folder hold a folder twice at every depth.
test("drift reports spaces without walking into a link to a folder", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  symlinkSync(".", join(app, "mods/spaces/a"));
  symlinkSync(".", join(app, "mods/spaces/b"));
  assert.deepEqual(driftAlone(snapshots, app), ["spaces"]);
});

// A loop ends at the file system's limit on links in one path, and a link listed as a file is
// reported however it is walked: neither shows a walk that lists a link, then goes into it.
// 25 folders in a chain, each with two links to the next, hold 2^24 paths and no loop.
test("drift reports spaces without walking into links to folders that branch and never loop", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  for (let i = 0; i < 25; i++) mkdirSync(join(app, `elsewhere/d${i}`), { recursive: true });
  for (let i = 0; i < 24; i++) for (const link of ["a", "b"]) symlinkSync(`../d${i + 1}`, join(app, `elsewhere/d${i}/${link}`));
  symlinkSync("../../elsewhere/d0", join(app, "mods/spaces/deep"));
  assert.deepEqual(driftAlone(snapshots, app), ["spaces"]);
});

// filesBelow is how drift lists a mod folder, and how the clones' own tests list theirs.
const folderOf = (t, files) => folders(t, files, {})[0];

test("filesBelow goes down into a real folder below", (t) => {
  const folder = folderOf(t, { "main.js": "", "lib/util.js": "", "lib/deep/x.js": "" });
  assert.deepEqual(filesBelow(folder).sort(), ["lib/deep/x.js", "lib/util.js", "main.js"]);
});

// Walked into, a link back to its own folder holds the folder again at every depth.
test("filesBelow lists a link to its own folder as one entry, never walked into", (t) => {
  const folder = folderOf(t, { "main.js": "" });
  symlinkSync(".", join(folder, "here"));
  assert.deepEqual(alone("filesBelow", folder).sort(), ["here", "main.js"]);
});

// 25 folders in a chain, each with two links to the next, hold 2^24 paths and no loop.
test("filesBelow lists links to folders that branch and never loop as one entry, in time", (t) => {
  const folder = folderOf(t, { "main.js": "" });
  const chain = join(dirname(folder), "chain");
  for (let i = 0; i < 25; i++) mkdirSync(join(chain, `d${i}`), { recursive: true });
  for (let i = 0; i < 24; i++) for (const link of ["a", "b"]) symlinkSync(`../d${i + 1}`, join(chain, `d${i}/${link}`));
  symlinkSync(join(chain, "d0"), join(folder, "deep"));
  assert.deepEqual(alone("filesBelow", folder).sort(), ["deep", "main.js"]);
});

// A URL ends its path at a "#": a path listed or read through one names another file.
test("filesBelow lists a name holding a # whole, as a path that reads the file", (t) => {
  const folder = folderOf(t, { "lib/a#b.js": "export const ab = 1;\n" });
  const listed = filesBelow(folder);
  assert.deepEqual(listed, ["lib/a#b.js"]);
  assert.equal(readFileSync(join(folder, listed[0]), "utf8"), "export const ab = 1;\n");
});

// codeIn is how the clones' own tests read the code their mod runs.
const byFile = (code) => code.toSorted((a, b) => a.file.localeCompare(b.file));

test("codeIn reads each .js file below a folder, its tests left out", (t) => {
  const folder = folderOf(t, { "main.js": "a\n", "lib/util.js": "b\n", "main.test.js": "c\n", "mod.json": "{}\n", "icon.svg": "<svg/>\n" });
  assert.deepEqual(byFile(codeIn(folder)), [{ file: "lib/util.js", text: "b\n" }, { file: "main.js", text: "a\n" }]);
});

test("codeIn lists a pipe with no text, without waiting for a writer", (t) => {
  const folder = folderOf(t, { "main.js": "a\n" });
  execFileSync("mkfifo", [join(folder, "stuck.js")]);
  assert.deepEqual(byFile(alone("codeIn", folder)), [{ file: "main.js", text: "a\n" }, { file: "stuck.js", text: null }]);
});

test("codeIn reads a link to a file, and lists a link that leads nowhere with no text", (t) => {
  const folder = folderOf(t, { "main.js": "a\n" });
  symlinkSync("main.js", join(folder, "same.js"));
  symlinkSync("gone.js", join(folder, "broken.js"));
  assert.deepEqual(byFile(codeIn(folder)), [{ file: "broken.js", text: null }, { file: "main.js", text: "a\n" }, { file: "same.js", text: "a\n" }]);
});

test("codeIn lists a link that leads back to itself with no text", (t) => {
  const folder = folderOf(t, { "main.js": "a\n" });
  symlinkSync("loop.js", join(folder, "loop.js"));
  assert.deepEqual(byFile(codeIn(folder)), [{ file: "loop.js", text: null }, { file: "main.js", text: "a\n" }]);
});

// A link to a folder may hold code the mod runs, under any name: filesBelow never walks into it.
test("codeIn lists anything below a folder but a regular file with no text, whatever its name", (t) => {
  const folder = folderOf(t, { "main.js": "a\n", "lib/x.js": "b\n", "README.md": "c\n" });
  symlinkSync("lib", join(folder, "shared"));
  symlinkSync("gone", join(folder, "broken"));
  assert.deepEqual(byFile(codeIn(folder)), [
    { file: "broken", text: null },
    { file: "lib/x.js", text: "b\n" },
    { file: "main.js", text: "a\n" },
    { file: "shared", text: null },
  ]);
});

// namesMod is what the clones' own tests look for a shipped mod's name with: taken code is
// carried by hand too, so the name is found however it is written.
test("namesMod finds a mod named in any quote and spacing, and its folder", () => {
  for (const text of ['mod: "x"', "mod: 'x'", "mod: `x`", '"mod": "x"', "'mod': 'x'", 'mod : "x"', 'mod:"x"', 'svg("mods/x/icon.svg")']) {
    assert.ok(namesMod("x").test(text), `not found: ${text}`);
  }
});

test("namesMod passes over another mod whose name starts with it", () => {
  for (const text of ['mod: "x-clone"', '"mod": "x-clone"', "mod: `x-clone`", 'svg("mods/x-clone/icon.svg")']) {
    assert.ok(!namesMod("x").test(text), `found: ${text}`);
  }
});

test("namesMod passes over a key that only starts or ends with mod", () => {
  for (const text of ['module: "x"', 'submod: "x"', '"submod": "x"', 'node_mod: "x"']) {
    assert.ok(!namesMod("x").test(text), `found: ${text}`);
  }
});

test("namesMod reads a mod's name as it is written, never as a pattern", () => {
  assert.ok(namesMod("x.y").test('mod: "x.y"'), 'not found: mod: "x.y"');
  for (const text of ['mod: "xzy"', 'svg("mods/xzy/icon.svg")']) {
    assert.ok(!namesMod("x.y").test(text), `found: ${text}`);
  }
});

// Root reads and searches whatever the permissions say: the refusals below never reach it.
const refusable = { skip: process.getuid?.() === 0 && "run as root, which no permission refuses" };

test("codeIn lists a file it may not read with no text", refusable, (t) => {
  const folder = folderOf(t, { "main.js": "a\n", "secret.js": "b\n" });
  chmodSync(join(folder, "secret.js"), 0o000);
  assert.deepEqual(byFile(codeIn(folder)), [{ file: "main.js", text: "a\n" }, { file: "secret.js", text: null }]);
});

for (const mod of ["spaces", "agents"]) {
  test(`drift reports ${mod} when one of its shipped files is now a link that leads back to itself`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, `mods/${mod}/main.js`));
    symlinkSync("main.js", join(app, `mods/${mod}/main.js`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when one of its shipped files cannot be read`, refusable, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
    chmodSync(join(app, `mods/${mod}/main.js`), 0o000);
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when a folder below its shipped folder cannot be read`, refusable, (t) => {
    const nested = { ...SHIPPED, [`mods/${mod}/fonts/pixel.ttf`]: "font\n" };
    const [snapshots, app] = folders(t, nested, nested);
    const fonts = join(app, `mods/${mod}/fonts`);
    chmodSync(fonts, 0o000);
    try {
      assert.deepEqual(drift(snapshots, app), [mod]);
    } finally {
      chmodSync(fonts, 0o755);
    }
  });
}

test("drift reports main when the shipped layouts/main.json cannot be read", refusable, (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  chmodSync(join(app, "layouts/main.json"), 0o000);
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

test("drift reports both mods when the shipped mods folder cannot be searched", refusable, (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  const mods = join(app, "mods");
  chmodSync(mods, 0o000);
  try {
    assert.deepEqual(drift(snapshots, app), ["spaces", "agents"]);
  } finally {
    chmodSync(mods, 0o755);
  }
});

test("drift throws an error that is not the file system's: a fault in it is never a Herdr change", (t) => {
  const [, app] = folders(t, SHIPPED, SHIPPED);
  assert.throws(() => drift(undefined, app), { code: "ERR_INVALID_ARG_TYPE" });
});

// A snapshot is a file cp wrote: a link among the snapshots, or on the way to one, compares
// what it leads to, the shipped file itself too, and hides every change; a hard link shares
// its bytes with its other name, the shipped file itself too.
const SNAPSHOT_TREE = { ...SHIPPED, "mods/spaces/fonts/pixel.ttf": "font\n" };

// Moves what is at a path of the snapshot folder out of it, and puts a link to it there.
const linkAway = (snapshots, path) => {
  const away = join(dirname(snapshots), "elsewhere", basename(path));
  mkdirSync(dirname(away), { recursive: true });
  renameSync(join(snapshots, path), away);
  symlinkSync(away, join(snapshots, path));
  return away;
};

test("snapshotLinks finds no link among snapshots that are files and folders", (t) => {
  assert.deepEqual(snapshotLinks(folderOf(t, SNAPSHOT_TREE)), []);
});

test("snapshotLinks finds no link where there is no snapshot yet", (t) => {
  assert.deepEqual(snapshotLinks(folderOf(t, {})), []);
});

for (const path of ["layouts/main.json", "mods/agents/main.js", "mods/spaces/fonts", "mods/agents", "mods", "layouts"]) {
  test(`snapshotLinks finds a link at ${path} to what was there`, (t) => {
    const snapshots = folderOf(t, SNAPSHOT_TREE);
    linkAway(snapshots, path);
    assert.deepEqual(snapshotLinks(snapshots), [path]);
  });
}

test("snapshotLinks finds a link that leads nowhere", (t) => {
  const snapshots = folderOf(t, without(SNAPSHOT_TREE, "mods/agents/mod.json"));
  symlinkSync("gone.json", join(snapshots, "mods/agents/mod.json"));
  assert.deepEqual(snapshotLinks(snapshots), ["mods/agents/mod.json"]);
});

// Walked into, the folder a link leads to would show its own links as the snapshots'.
for (const [path, inside] of [["mods/agents", "same.js"], ["mods", "agents/same.js"]]) {
  test(`snapshotLinks never walks into a link at ${path}`, (t) => {
    const snapshots = folderOf(t, SNAPSHOT_TREE);
    symlinkSync("main.js", join(linkAway(snapshots, path), inside));
    assert.deepEqual(snapshotLinks(snapshots), [path]);
  });
}

for (const path of ["layouts/main.json", "mods/spaces/fonts/pixel.ttf"]) {
  test(`snapshotLinks finds a hard link at ${path}`, (t) => {
    const snapshots = folderOf(t, SNAPSHOT_TREE);
    mkdirSync(join(dirname(snapshots), "elsewhere"));
    linkSync(join(snapshots, path), join(dirname(snapshots), "elsewhere", basename(path)));
    assert.deepEqual(snapshotLinks(snapshots), [path]);
  });
}

test("snapshotLinks finds both names of two snapshots hard-linked to each other", (t) => {
  const snapshots = folderOf(t, without(SNAPSHOT_TREE, "mods/agents/mod.json"));
  linkSync(join(snapshots, "mods/spaces/mod.json"), join(snapshots, "mods/agents/mod.json"));
  assert.deepEqual(snapshotLinks(snapshots).toSorted(), ["mods/agents/mod.json", "mods/spaces/mod.json"]);
});

// The snapshots are this repo's: a file in place of a folder on their way is a fault here, and red.
for (const path of ["mods", "layouts"]) {
  test(`snapshotLinks throws where a file is in place of the folder ${path}`, (t) => {
    const outside = Object.entries(SNAPSHOT_TREE).filter(([file]) => !file.startsWith(`${path}/`));
    const snapshots = folderOf(t, { ...Object.fromEntries(outside), [path]: "x\n" });
    assert.throws(() => snapshotLinks(snapshots), { code: "ENOTDIR" });
  });
}

// The clones in the app folder, each naming another version: each name reads its own.
const cloneOf = (name, version) => `${JSON.stringify({ place: "none", cloned_from: { name, version } })}\n`;
const CLONES = {
  "mods/spaces-cards/mod.json": cloneOf("spaces", "0.1.18"),
  "mods/agents-context/mod.json": cloneOf("agents", "0.1.17"),
  "layouts/cards.json": cloneOf("main", "0.1.16"),
};

test("verdict passes every name whose shipped files are their snapshots", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, { ...SHIPPED, ...CLONES });
  for (const name of ["spaces", "agents", "main"]) assert.equal(verdict(snapshots, app, name), null, name);
});

test("verdict skips a changed name with the message that names it, its clone's version and the uptake", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, { ...SHIPPED, ...CLONES, "mods/agents/main.js": "changed\n", "layouts/main.json": "changed\n" });
  assert.equal(verdict(snapshots, app, "spaces"), null);
  assert.equal(verdict(snapshots, app, "agents"), "agents changed in Herdr since 0.1.17: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md");
  assert.equal(verdict(snapshots, app, "main"), "main changed in Herdr since 0.1.16: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md");
});

test("verdict passes every name whose shipped files are absent", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, CLONES);
  for (const name of ["spaces", "agents", "main"]) assert.equal(verdict(snapshots, app, name), null, name);
});

// A clone file is this repo's, never Herdr's: what is wrong with one is red, changed or not.
for (const [what, clone, error] of [
  ["is gone", undefined, { code: "ENOENT" }],
  ["is not JSON", "{\n", SyntaxError],
  ["names no version it was cloned from", '{ "place": "none" }\n', /names no version/],
  ["names a version that is not a string", cloneOf("agents", ["0.1.17"]), /names no version/],
  ["names a version that is not one", cloneOf("agents", "latest"), /names no version/],
  ["names a version with something before its three numbers", cloneOf("agents", "v0.1.17"), /names no version/],
  ["names a version with something after its three numbers", cloneOf("agents", "0.1.17-rc1"), /names no version/],
]) {
  test(`verdict throws when the clone file of a name ${what}, whether or not the name changed`, (t) => {
    const clones = clone === undefined ? without(CLONES, "mods/agents-context/mod.json") : { ...CLONES, "mods/agents-context/mod.json": clone };
    for (const shipped of [SHIPPED, { ...SHIPPED, "mods/agents/main.js": "changed\n" }]) {
      const [snapshots, app] = folders(t, SHIPPED, { ...shipped, ...clones });
      assert.throws(() => verdict(snapshots, app, "agents"), error);
    }
  });
}

test("verdict throws when the clone file of a name cannot be read", refusable, (t) => {
  const [snapshots, app] = folders(t, SHIPPED, { ...SHIPPED, ...CLONES });
  chmodSync(join(app, "mods/agents-context/mod.json"), 0o000);
  assert.throws(() => verdict(snapshots, app, "agents"), { code: "EACCES" });
});

// The real folders: this file sits in the snapshot folder, inside the app folder.
const SNAPSHOTS = import.meta.dirname;
const APP = join(SNAPSHOTS, "..");

const clonedFrom = (clone) => JSON.parse(readFileSync(join(APP, clone), "utf8")).cloned_from;

test("the three clones name one version: an uptake moves all three together", () => {
  const taken = Object.values(CLONE_OF).map((clone) => ({ clone, version: clonedFrom(clone).version }));
  const named = taken.map(({ clone, version }) => `${clone} ${version}`).join(", ");
  assert.equal(new Set(taken.map(({ version }) => version)).size, 1, `the clones name more than one version: ${named}`);
});

// The clones' own tests look for the shipped name cloned_from.name records: this pins it.
test("each clone names the shipped name it stands in for", () => {
  for (const [name, clone] of Object.entries(CLONE_OF)) assert.equal(clonedFrom(clone).name, name, clone);
});

// A link among the snapshots would pass the live tests below whatever Herdr changed.
test("no snapshot is a link, nor has one on its way", () => {
  assert.deepEqual(snapshotLinks(SNAPSHOTS), []);
});

// Every mod a layout names, at any depth: its blocks, floating blocks and pane headers.
const modsIn = (node) =>
  node !== null && typeof node === "object" ? Object.entries(node).flatMap(([key, value]) => (key === "mod" ? [value] : modsIn(value))) : [];

// A block carried by hand from the shipped layout names the clone, never the shipped mod.
test("the cards layout never opens the shipped mods the clones stand in for", () => {
  const named = modsIn(JSON.parse(readFileSync(join(APP, CLONE_OF.main), "utf8")));
  assert.deepEqual(named.filter((mod) => mod === "spaces" || mod === "agents"), []);
});

// The check above passes on a layout it read nothing from: this one shows it read the blocks.
test("the cards layout opens both clones", () => {
  const named = modsIn(JSON.parse(readFileSync(join(APP, CLONE_OF.main), "utf8")));
  for (const clone of ["spaces-cards", "agents-context"]) assert.ok(named.includes(clone), `the cards layout opens no ${clone}`);
});

for (const name of Object.keys(CLONE_OF)) {
  test(`shipped ${name} is the version taken`, (t) => {
    const skip = verdict(SNAPSHOTS, APP, name);
    if (skip) t.skip(skip);
  });
}
