// Which shipped Herdr mods and layouts differ from their snapshots, and what the live test
// of each does about it. No herdr or gpui-kit import, so Node can test it.

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Never Herdr's sources: the app writes the first two into every mod folder, and Finder
// leaves the third in any folder it showed.
const NOT_SHIPPED = ["gpui-kit.d.ts", "jsconfig.json", ".DS_Store"];

// stat follows a link, lstat does not: a link that leads nowhere has an lstat, and is no file.
// A path that is not there has neither. A path the file system refuses makes lstat throw, and
// so does a path below a file, which Node's statSync answers with undefined (its quirk with
// ENOTDIR): either way its name differs.
const stat = (path) => statSync(path, { throwIfNoEntry: false });
const lstat = (path) => lstatSync(path, { throwIfNoEntry: false });
const exists = (path) => lstat(path) !== undefined;

// Whatever is not a folder counts as a file, a link included: one level is listed at a time,
// and only a real folder is gone down into, so a link to a folder is never walked into.
const sources = (folder, below = "") =>
  readdirSync(join(folder, below), { withFileTypes: true })
    .filter((entry) => !NOT_SHIPPED.includes(entry.name))
    .flatMap((entry) => (entry.isDirectory() ? sources(folder, join(below, entry.name)) : [join(below, entry.name)]));

// A mod folder is listed only when it is a real folder. Anything else there, a link to a
// folder included, is one entry: the folder itself, compared as a file, so it differs. A
// folder that is not there lists nothing: no snapshot yet is a state, not a refusal.
const filesIn = (folder) => {
  const entry = lstat(folder);
  if (entry === undefined) return [];
  return entry.isDirectory() ? sources(folder) : [""];
};

// Only two regular files of one size are read: anything else where a file was (a folder, a
// pipe whose read would wait for a writer) is a difference, and so is another size, which
// spares reading a file too large to read whole.
const same = (snapshot, shipped) => {
  const [a, b] = [stat(snapshot), stat(shipped)];
  if (!a?.isFile() || !b?.isFile() || a.size !== b.size) return false;
  return readFileSync(snapshot).equals(readFileSync(shipped));
};

// Every file on either side counts, so a file a release added or dropped is a difference.
const modDiffers = (snapshot, shipped) =>
  [...filesIn(snapshot), ...filesIn(shipped)].some((file) => !same(join(snapshot, file), join(shipped, file)));

const layoutDiffers = (snapshot, shipped) => !same(snapshot, shipped);

// A snapshot's path in the snapshot folder is the shipped path in the app folder.
const SHIPPED = {
  spaces: { path: "mods/spaces", differs: modDiffers },
  agents: { path: "mods/agents", differs: modDiffers },
  main: { path: "layouts/main.json", differs: layoutDiffers },
};

// What the file system refuses to read cannot be shown to be its snapshot: it differs.
// Anything else thrown is a fault in this file.
const differsOrCannotBeRead = (compare) => {
  try {
    return compare();
  } catch (error) {
    if (error?.syscall === undefined) throw error;
    return true;
  }
};

// The names whose shipped files are not byte-for-byte their snapshots. A name the app
// folder does not ship (a machine without the Herdr app) is not reported; one it cannot
// look at is.
export const drift = (snapshots, app) =>
  Object.entries(SHIPPED)
    .filter(([, { path, differs }]) =>
      differsOrCannotBeRead(() => exists(join(app, path)) && differs(join(snapshots, path), join(app, path))))
    .map(([name]) => name);

// The clone of each name, in the app folder: its cloned_from.version is the version the
// snapshots hold.
export const CLONE_OF = {
  spaces: "mods/spaces-cards/mod.json",
  agents: "mods/agents-context/mod.json",
  main: "layouts/cards.json",
};

// What the live test of a name does: null to pass, or the message to skip with. What is
// wrong with a clone file throws, changed or not: that is this repo's fault, never Herdr's.
export const verdict = (snapshots, app, name) => {
  const taken = JSON.parse(readFileSync(join(app, CLONE_OF[name]), "utf8"))?.cloned_from?.version;
  if (typeof taken !== "string" || !/^\d+\.\d+\.\d+$/.test(taken)) throw new Error(`${CLONE_OF[name]} names no version it was cloned from`);
  return drift(snapshots, app).includes(name) ? `${name} changed in Herdr since ${taken}: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md` : null;
};
