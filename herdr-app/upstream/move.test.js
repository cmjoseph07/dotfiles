import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// "Move the snapshots" and "Remove the staging folder of a stopped move" are run by hand at an
// uptake, and they write. Each is taken from the spec as it is written there, from its title
// comment to the blank line after it, and run in bash and in zsh against scratch trees, so an
// edit that breaks what its comment says is red here.
const SPEC = readFileSync(new URL("../docs/clone-upkeep/SPEC.md", import.meta.url), "utf8").split("\n");
const block = (title) => {
  const starts = SPEC.flatMap((line, i) => (line.startsWith(title) ? [i] : []));
  if (starts.length !== 1) throw new Error(`the spec holds ${starts.length} lines starting ${title}`);
  const end = SPEC.indexOf("", starts[0]);
  return SPEC.slice(starts[0], end === -1 ? undefined : end).join("\n");
};
const MOVE = block("# Move the snapshots to the version taken.");
const CLEAN = block("# Remove the staging folder of a stopped move:");

// The shipped files the move takes, as its own list names them, in its order: an uptake that
// adds one adds it there alone.
const FILES = MOVE.match(/; set -- (.+)$/m)?.[1].split(" ") ?? [];
if (FILES.length === 0) throw new Error("the move names no shipped file it takes");
const first = (folder) => FILES.find((file) => file.startsWith(folder));
const [SPACES, AGENTS, LAYOUT] = [first("mods/spaces/"), first("mods/agents/"), first("layouts/")];

// The move takes BSD mv -h, and the rename case sets a macOS ACL: this file runs on macOS only.
const offMac = process.platform !== "darwin" && "the move takes BSD mv -h, which macOS has";
// Root writes and reads whatever the permissions say: the refusals below never reach it.
const asRoot = process.getuid?.() === 0 && "run as root, which no permission refuses";

// zsh reads no rc file, and bash takes nothing from the environment that changes how it runs:
// what runs is the block alone. A block that hangs is stopped at 10 s, and so is whatever it
// started, which stopping the shell alone would leave waiting.
const SHELLS = { bash: ["bash"], zsh: ["zsh", "-f"] };
const has = (shell) => spawnSync(SHELLS[shell][0], ["-c", "true"]).status === 0;
const run = (shell, cwd, script, env = {}) => {
  const inherited = Object.entries(process.env).filter(([name]) => !/^(BASH_ENV|ENV|SHELLOPTS|BASHOPTS|CDPATH)$|^BASH_FUNC_/.test(name));
  const [command, ...flags] = SHELLS[shell];
  const result = spawnSync(command, [...flags, "-c", script], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
    detached: true,
    env: { ...Object.fromEntries(inherited), LC_ALL: "C", ...env },
  });
  try {
    process.kill(-result.pid, "SIGKILL");
  } catch {
    // The group is gone: the block ended, and all it started with it.
  }
  return result;
};
const why = (result) => result.error?.message ?? result.stderr;

const SHIPPED = (file) => `shipped ${file}\n`;
const SNAPSHOT = (file) => `snapshot ${file}\n`;
const OUTSIDE = "outside\n";

const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

// A scratch ~/.config, its path holding a space: herdr-app with the shipped files, their
// snapshots one version behind and a file beside them that is neither, and a folder outside it
// that a write through a link would reach. Removed when the test ends, ACLs and modes put back
// first, as a folder set to 555 keeps rm out of it.
const scratch = (t) => {
  const root = mkdtempSync(join(tmpdir(), "move snapshots-"));
  t.after(() => {
    spawnSync("chmod", ["-R", "-N", root]);
    spawnSync("chmod", ["-R", "u+rwX", root]);
    rmSync(root, { recursive: true, force: true });
  });
  const app = join(root, "herdr-app");
  for (const file of FILES) {
    write(join(app, file), SHIPPED(file));
    write(join(app, "upstream", file), SNAPSHOT(file));
  }
  write(join(app, "upstream/drift.js"), "not a snapshot\n");
  write(join(app, dirname(SPACES), "icon.svg"), "not shipped code\n");
  write(join(root, "outside/file"), OUTSIDE);
  return { root, app, up: join(app, "upstream"), outside: join(root, "outside") };
};

const lstat = (path) => lstatSync(path, { throwIfNoEntry: false });
// A regular file's text, "unreadable" when it may not be read, null for anything else.
const textAt = (path) => {
  if (!lstat(path)?.isFile()) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "unreadable";
  }
};
// Everything below a folder, by its path: a folder null, a link "link" and never walked into, a
// file its text, anything else "other".
const tree = (folder, path = "") =>
  Object.fromEntries(
    readdirSync(join(folder, path)).flatMap((name) => {
      const at = join(path, name);
      const entry = lstat(join(folder, at));
      if (entry.isSymbolicLink()) return [[at, "link"]];
      if (entry.isDirectory()) return [[at, null], ...Object.entries(tree(folder, at))];
      return [[at, entry.isFile() ? textAt(join(folder, at)) : "other"]];
    }),
  );
// The snapshots the move wrote: each a regular file of one name holding its shipped file's text.
const moved = ({ up }) =>
  FILES.filter((file) => {
    const entry = lstat(join(up, file));
    return entry?.isFile() && entry.nlink === 1 && textAt(join(up, file)) === SHIPPED(file);
  });
const staging = ({ up }) => readdirSync(up).filter((name) => name.startsWith(".move.")).toSorted();

// A move of all five, silent, where nothing changed in herdr-app since before but the
// snapshots, each now its shipped file, and the folders they needed.
const foldersOn = (path) => dirname(path).split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"));
const assertMovedAll = (s, result, before) => {
  assert.equal(result.status, 0, why(result));
  assert.equal(result.stderr, "");
  assert.deepEqual(moved(s), FILES);
  const snapshots = FILES.flatMap((file) => [...foldersOn(join("upstream", file)).map((folder) => [folder, null]), [join("upstream", file), SHIPPED(file)]]);
  assert.deepEqual(tree(s.app), { ...before, ...Object.fromEntries(snapshots) });
};

// Puts a link at a path of herdr-app to what was there, moved into the folder outside.
const linkAway = (s, path) => {
  const away = join(s.outside, "away", path);
  mkdirSync(dirname(away), { recursive: true });
  renameSync(join(s.app, path), away);
  symlinkSync(away, join(s.app, path));
};
const replace = (s, path, put) => {
  rmSync(join(s.app, path), { recursive: true });
  put(join(s.app, path));
};
const mkfifo = (path) => execFileSync("mkfifo", [path]);
const aFile = (path) => write(path, "x\n");

const MOVES_ALL = {
  "a tree as an uptake finds it": () => {},
  "no upstream folder yet": (s) => rmSync(s.up, { recursive: true }),
  "no agents snapshot yet": (s) => rmSync(join(s.up, dirname(AGENTS)), { recursive: true }),
  "a snapshot hard-linked to a file outside, which keeps its text": (s) =>
    replace(s, `upstream/${LAYOUT}`, (path) => linkSync(join(s.outside, "file"), path)),
  "a snapshot hard-linked to another shipped file, which keeps its text": (s) =>
    replace(s, `upstream/${AGENTS}`, (path) => linkSync(join(s.app, SPACES), path)),
  "a staging folder an earlier stop left, which stays": (s) => write(join(s.up, ".move.left00", LAYOUT), "left\n"),
};

// Each stop: what is wrong in the tree, the message it stops with, and why it cannot be staged
// here, if it cannot.
const notAsShipped = (path) => `not a regular file, or a link or not a folder on its way: herdr-app/${path}\n`;
const cannotWrite = (path) => `cannot write herdr-app/${path}\n`;
const STOPS = {
  "a link at a snapshot": { arrange: (s) => linkAway(s, `upstream/${LAYOUT}`), message: notAsShipped(`upstream/${LAYOUT}`) },
  "a link that leads nowhere at a snapshot": {
    arrange: (s) => replace(s, `upstream/${AGENTS}`, (path) => symlinkSync("gone", path)),
    message: notAsShipped(`upstream/${AGENTS}`),
  },
  "a link at a snapshot folder": { arrange: (s) => linkAway(s, `upstream/${dirname(LAYOUT)}`), message: notAsShipped(`upstream/${LAYOUT}`) },
  "a link at upstream": { arrange: (s) => linkAway(s, "upstream"), message: notAsShipped(`upstream/${FILES[0]}`) },
  "a link at a shipped file": { arrange: (s) => linkAway(s, LAYOUT), message: notAsShipped(LAYOUT) },
  "a link at the shipped mods folder": { arrange: (s) => linkAway(s, "mods"), message: notAsShipped(first("mods/")) },
  "a pipe as a shipped file": { arrange: (s) => replace(s, AGENTS, mkfifo), message: notAsShipped(AGENTS) },
  "a pipe at a snapshot": { arrange: (s) => replace(s, `upstream/${SPACES}`, mkfifo), message: notAsShipped(`upstream/${SPACES}`) },
  "a file where a snapshot folder goes": { arrange: (s) => replace(s, `upstream/${dirname(LAYOUT)}`, aFile), message: notAsShipped(`upstream/${LAYOUT}`) },
  "a file where a snapshot mod folder goes": { arrange: (s) => replace(s, `upstream/${dirname(AGENTS)}`, aFile), message: notAsShipped(`upstream/${AGENTS}`) },
  "a folder where a snapshot goes": { arrange: (s) => replace(s, `upstream/${AGENTS}`, mkdirSync), message: notAsShipped(`upstream/${AGENTS}`) },
  "a missing shipped file": { arrange: (s) => rmSync(join(s.app, SPACES)), message: notAsShipped(SPACES) },
  "a snapshot set to 444": { arrange: (s) => chmodSync(join(s.up, AGENTS), 0o444), message: cannotWrite(`upstream/${AGENTS}`), skip: asRoot },
  "a snapshot folder set to 555": { arrange: (s) => chmodSync(join(s.up, dirname(AGENTS)), 0o555), message: cannotWrite(`upstream/${AGENTS}`), skip: asRoot },
  "a snapshot folder it cannot make": {
    arrange: (s) => {
      rmSync(join(s.up, dirname(AGENTS)), { recursive: true });
      chmodSync(join(s.up, dirname(dirname(AGENTS))), 0o555);
    },
    message: `mkdir: upstream/${dirname(AGENTS)}: Permission denied\n${cannotWrite(`upstream/${AGENTS}`)}`,
    skip: asRoot,
  },
  "upstream set to 555": { arrange: (s) => chmodSync(s.up, 0o555), message: cannotWrite("upstream"), skip: asRoot },
  "a shipped file it may not read, past its checks": {
    arrange: (s) => chmodSync(join(s.app, SPACES), 0o000),
    message: `cp: ${SPACES}: Permission denied\n`,
    skip: asRoot,
  },
};

// An interactive zsh runs a # line as a command unless interactive_comments is set: a ' there
// opens a quote that swallows the lines below it, so a pasted block runs other than it reads.
test("no comment in a block of the spec's Commands holds a '", () => {
  const start = SPEC.indexOf("## Commands");
  const end = SPEC.findIndex((line, i) => i > start && line.startsWith("## "));
  let inBlock = false;
  const found = SPEC.slice(start, end).flatMap((line, i) => {
    if (line.startsWith("```")) inBlock = !inBlock;
    else if (inBlock && /^\s*#/.test(line) && line.includes("'")) return [`SPEC.md:${start + i + 1}`];
    return [];
  });
  assert.deepEqual(found, []);
});

for (const shell of Object.keys(SHELLS)) {
  const skip = offMac || (!has(shell) && `no ${shell}`);

  for (const [name, arrange] of Object.entries(MOVES_ALL)) {
    test(`${shell}: Move the snapshots moves all five with ${name}`, { skip }, (t) => {
      const s = scratch(t);
      arrange(s);
      const [before, outside] = [tree(s.app), tree(s.outside)];
      assertMovedAll(s, run(shell, s.root, MOVE), before);
      assert.deepEqual(tree(s.outside), outside);
    });
  }

  for (const [name, { arrange, message, skip: cannot }] of Object.entries(STOPS)) {
    test(`${shell}: Move the snapshots stops on ${name}, having moved nothing`, { skip: skip || cannot }, (t) => {
      const s = scratch(t);
      arrange(s);
      const [before, outside] = [tree(s.app), tree(s.outside)];
      const result = run(shell, s.root, MOVE);
      assert.equal(result.status, 1, why(result));
      assert.equal(result.stderr, message);
      assert.deepEqual(tree(s.app), before);
      assert.deepEqual(tree(s.outside), outside);
    });
  }

  test(`${shell}: Move the snapshots run from a folder with no herdr-app in it stops at its cd`, { skip }, (t) => {
    const s = scratch(t);
    const result = run(shell, s.outside, MOVE);
    assert.equal(result.status, 1, why(result));
    assert.match(result.stderr, /^[^\n]*\.\/herdr-app[^\n]*\n$/);
    assert.deepEqual(tree(s.outside), { file: OUTSIDE });
    assert.deepEqual(moved(s), []);
  });

  test(`${shell}: Move the snapshots moves this tree, never the herdr-app on CDPATH`, { skip }, (t) => {
    const [s, other] = [scratch(t), scratch(t)];
    assertMovedAll(s, run(shell, s.root, MOVE, { CDPATH: other.root }), tree(s.app));
    assert.deepEqual(moved(other), []);
  });

  test(`${shell}: Move the snapshots run from a folder with no herdr-app in it never moves the one on CDPATH`, { skip }, (t) => {
    const [s, other] = [scratch(t), scratch(t)];
    assert.equal(run(shell, s.outside, MOVE, { CDPATH: other.root }).status, 1);
    assert.deepEqual(moved(other), []);
  });

  // Step 5: some snapshots moved, the staging folder removed, and once the cause is put right
  // the move run again takes all five.
  test(`${shell}: Move the snapshots stops on a rename its checks cannot foresee, and runs again once it is put right`, { skip: skip || asRoot }, (t) => {
    const s = scratch(t);
    const last = join(s.up, FILES.at(-1));
    execFileSync("chmod", ["+a", "everyone deny delete", last]);
    assert.equal(run(shell, s.root, MOVE).status, 1);
    assert.deepEqual(moved(s), FILES.slice(0, -1));
    assert.equal(textAt(last), SNAPSHOT(FILES.at(-1)));
    assert.deepEqual(staging(s), []);
    execFileSync("chmod", ["-N", last]);
    assertMovedAll(s, run(shell, s.root, MOVE), tree(s.app));
  });

  // A link to a folder outside put at a snapshot once the checks and copies are done: mv alone
  // moves the copy into the folder it leads to.
  test(`${shell}: Move the snapshots replaces a link put at a snapshot after its checks`, { skip }, (t) => {
    const s = scratch(t);
    const lines = MOVE.split("\n");
    const renames = lines.findIndex((line) => line.startsWith("for f; do mv "));
    assert.notEqual(renames, -1, "the move renames its copies on no line of its own");
    lines.splice(renames, 0, 'rm "upstream/$LINKED" && mkdir "$AWAY" && ln -s "$AWAY" "upstream/$LINKED" || exit 9');
    const before = tree(s.app);
    assertMovedAll(s, run(shell, s.root, lines.join("\n"), { LINKED: LAYOUT, AWAY: join(s.outside, "away") }), before);
    assert.deepEqual(tree(s.outside), { away: null, file: OUTSIDE });
  });

  test(`${shell}: Remove the staging folder of a stopped move removes only a staging folder`, { skip }, (t) => {
    const s = scratch(t);
    write(join(s.up, ".move.abc123", LAYOUT), "left\n");
    write(join(s.outside, ".move.out123/kept"), "kept\n");
    symlinkSync(join(s.outside, ".move.out123"), join(s.up, ".move.lnk123"));
    write(join(s.up, ".move.file12"), "kept\n");
    mkdirSync(join(s.up, ".move.longer7"));
    mkdirSync(join(s.up, "mods/.move.nest12"));
    const result = run(shell, s.root, CLEAN);
    assert.equal(result.status, 0, why(result));
    assert.deepEqual(staging(s), [".move.file12", ".move.lnk123", ".move.longer7"]);
    assert.ok(lstat(join(s.up, "mods/.move.nest12"))?.isDirectory(), "a folder below upstream was removed");
    assert.deepEqual(tree(s.outside), { ".move.out123": null, ".move.out123/kept": "kept\n", file: OUTSIDE });
  });

  test(`${shell}: Remove the staging folder of a stopped move never follows a link at upstream`, { skip }, (t) => {
    const s = scratch(t);
    linkAway(s, "upstream");
    mkdirSync(join(s.outside, "away/upstream/.move.xyz789"));
    assert.equal(run(shell, s.root, CLEAN).status, 0);
    assert.ok(lstat(join(s.outside, "away/upstream/.move.xyz789"))?.isDirectory(), "the folder behind the link was removed");
  });
}
