import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CLONE_OF, drift, verdict } from "./drift.js";

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
    const others = Object.fromEntries(Object.entries(SHIPPED).filter(([path]) => !path.startsWith(`mods/${mod}/`)));
    const [snapshots, app] = folders(t, SHIPPED, others);
    symlinkSync("gone", join(app, `mods/${mod}`));
    assert.deepEqual(drift(snapshots, app), [mod]);
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

// drift in a process of its own, ended if it has not answered in 5 seconds: nothing in this
// process could end a read of a pipe, which waits for a writer, or a walk that never ends.
const driftAlone = (snapshots, app) => {
  const script = `import { drift } from ${JSON.stringify(import.meta.resolve("./drift.js"))};
console.log(JSON.stringify(drift(${JSON.stringify(snapshots)}, ${JSON.stringify(app)})));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8", timeout: 5000 });
  assert.equal(run.signal, null, "drift did not answer in 5 seconds");
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

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

// Root reads and searches whatever the permissions say: the refusals below never reach it.
const refusable = { skip: process.getuid?.() === 0 && "run as root, which no permission refuses" };

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

test("the three clones name one version: an uptake moves all three together", () => {
  const taken = Object.values(CLONE_OF).map((clone) => ({ clone, version: JSON.parse(readFileSync(join(APP, clone), "utf8")).cloned_from.version }));
  const named = taken.map(({ clone, version }) => `${clone} ${version}`).join(", ");
  assert.equal(new Set(taken.map(({ version }) => version)).size, 1, `the clones name more than one version: ${named}`);
});

// Every mod a layout names, at any depth: its blocks, floating blocks and pane headers.
const modsIn = (node) =>
  node !== null && typeof node === "object" ? Object.entries(node).flatMap(([key, value]) => (key === "mod" ? [value] : modsIn(value))) : [];

// A block carried by hand from the shipped layout names the clone, never the shipped mod.
test("the cards layout never opens the shipped mods the clones stand in for", () => {
  const named = modsIn(JSON.parse(readFileSync(join(APP, CLONE_OF.main), "utf8")));
  assert.deepEqual(named.filter((mod) => mod === "spaces" || mod === "agents"), []);
});

for (const name of Object.keys(CLONE_OF)) {
  test(`shipped ${name} is the version taken`, (t) => {
    const skip = verdict(SNAPSHOTS, APP, name);
    if (skip) t.skip(skip);
  });
}
