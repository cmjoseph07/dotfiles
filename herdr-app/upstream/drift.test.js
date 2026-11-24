import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { drift } from "./drift.js";

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
    assert.equal(changed[path].length, SHIPPED[path].length);
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

// A read of a pipe waits for a writer, and nothing in this process could end that wait:
// drift runs in a process of its own, ended if it waits.
test("drift reports spaces without waiting when a shipped file is now a pipe", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, "mods/spaces/main.js"));
  execFileSync("mkfifo", [join(app, "mods/spaces/main.js")]);
  const script = `import { drift } from ${JSON.stringify(import.meta.resolve("./drift.js"))};
console.log(JSON.stringify(drift(${JSON.stringify(snapshots)}, ${JSON.stringify(app)})));`;
  const run = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8", timeout: 5000 });
  assert.equal(run.signal, null, "drift waited on the pipe");
  assert.deepEqual(JSON.parse(run.stdout), ["spaces"]);
});

for (const mod of ["spaces", "agents"]) {
  test(`drift reports ${mod} when one of its shipped files is now a link that leads back to itself`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, without(SHIPPED, `mods/${mod}/main.js`));
    symlinkSync("main.js", join(app, `mods/${mod}/main.js`));
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when one of its shipped files cannot be read`, (t) => {
    const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
    chmodSync(join(app, `mods/${mod}/main.js`), 0o000);
    assert.deepEqual(drift(snapshots, app), [mod]);
  });

  test(`drift reports ${mod} when a folder below its shipped folder cannot be read`, (t) => {
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

test("drift reports main when the shipped layouts/main.json cannot be read", (t) => {
  const [snapshots, app] = folders(t, SHIPPED, SHIPPED);
  chmodSync(join(app, "layouts/main.json"), 0o000);
  assert.deepEqual(drift(snapshots, app), ["main"]);
});

test("drift reports both mods when the shipped mods folder cannot be searched", (t) => {
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

// The real folders: this file sits in the snapshot folder, inside the app folder.
const SNAPSHOTS = import.meta.dirname;
const APP = join(SNAPSHOTS, "..");
const CLONE_OF = {
  spaces: "mods/spaces-cards/mod.json",
  agents: "mods/agents-context/mod.json",
  main: "layouts/cards.json",
};

for (const [name, clone] of Object.entries(CLONE_OF)) {
  test(`shipped ${name} is the version taken`, (t) => {
    const taken = JSON.parse(readFileSync(join(APP, clone), "utf8")).cloned_from.version;
    assert.match(taken, /^\d+\.\d+\.\d+$/);
    if (drift(SNAPSHOTS, APP).includes(name)) t.skip(`${name} changed in Herdr since ${taken}: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md`);
  });
}
