// Which shipped Herdr mods and layouts differ from their snapshots, and what the live test
// of each does about it; and how the clones' own tests read their code and look for a
// shipped name. No herdr or gpui-kit import, so Node can test it.

import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

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

// Everything below a folder but its folders, as paths relative to it. Whatever is not a real
// folder counts as a file, a link included: one level is listed at a time and only a real
// folder is gone down into, so a link to a folder is never walked into. The clones' own
// tests list their mod folders with it too, through codeIn.
export const filesBelow = (folder) => {
  const below = (path) =>
    readdirSync(join(folder, path), { withFileTypes: true })
      .flatMap((entry) => (entry.isDirectory() ? below(join(path, entry.name)) : [join(path, entry.name)]));
  return below("");
};

// A mod folder's files, or null when its path holds anything but a real folder (a link, to a
// folder too, or a file): that is never a mod folder, on either side, whatever it holds or
// leads to. A folder that is not there lists nothing: no snapshot yet is a state, not a refusal.
const filesIn = (folder) => {
  const entry = lstat(folder);
  if (entry === undefined) return [];
  return entry.isDirectory() ? filesBelow(folder).filter((file) => !NOT_SHIPPED.includes(basename(file))) : null;
};

// Only two regular files of one size are read: anything else where a file was (a folder, a
// pipe whose read would wait for a writer) is a difference, and so is another size, which
// spares reading a file too large to read whole.
const same = (snapshot, shipped) => {
  const [a, b] = [stat(snapshot), stat(shipped)];
  if (!a?.isFile() || !b?.isFile() || a.size !== b.size) return false;
  return readFileSync(snapshot).equals(readFileSync(shipped));
};

// A mod folder that is not a real folder, on either side, differs. Otherwise every file on
// either side counts, so a file a release added or dropped is a difference.
const modDiffers = (snapshot, shipped) => {
  const [a, b] = [filesIn(snapshot), filesIn(shipped)];
  return a === null || b === null || [...a, ...b].some((file) => !same(join(snapshot, file), join(shipped, file)));
};

const layoutDiffers = (snapshot, shipped) => !same(snapshot, shipped);

// A snapshot's path in the snapshot folder is the shipped path in the app folder.
const SHIPPED = {
  spaces: { path: "mods/spaces", differs: modDiffers },
  agents: { path: "mods/agents", differs: modDiffers },
  main: { path: "layouts/main.json", differs: layoutDiffers },
};

// What read gives, or refused when the file system refuses to look: what cannot be read
// cannot be shown to be its snapshot, nor to name no mod. Anything else thrown is a fault in
// this file.
const orIfRefused = (read, refused) => {
  try {
    return read();
  } catch (error) {
    if (error?.syscall === undefined) throw error;
    return refused;
  }
};

// The names whose shipped files are not byte-for-byte their snapshots. A name the app
// folder does not ship (a machine without the Herdr app) is not reported; one it cannot
// look at is.
export const drift = (snapshots, app) =>
  Object.entries(SHIPPED)
    .filter(([, { path, differs }]) =>
      orIfRefused(() => exists(join(app, path)) && differs(join(snapshots, path), join(app, path)), true))
    .map(([name]) => name);

// The links among the snapshots and on the way to them, as paths in the snapshot folder: a
// link, or a file with another name (a hard link). A snapshot is a file cp wrote: a link there
// compares what it leads to, and a hard link what shares its bytes, the shipped file itself too,
// and hides every change. drift follows a link above a name, as the app folder may hold one;
// the snapshot folder never does. A mod folder is walked only when it and every folder on its
// way are real folders, so a link is never walked into.
const onTheWay = (path) => path.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"));
const isLink = (entry) => entry !== undefined && (entry.isSymbolicLink() || (entry.isFile() && entry.nlink > 1));
export const snapshotLinks = (snapshots) => {
  const paths = Object.values(SHIPPED).flatMap(({ path }) => {
    const way = onTheWay(path);
    const walked = way.every((folder) => lstat(join(snapshots, folder))?.isDirectory());
    return [...way, ...(walked ? filesBelow(join(snapshots, path)).map((file) => join(path, file)) : [])];
  });
  return [...new Set(paths)].filter((path) => isLink(lstat(join(snapshots, path))));
};

// The code a mod folder runs, for the clones' own tests: each .js file below it but its tests,
// with its text, and anything else below it, whatever its name, that is not a regular file, as
// a link to a folder may hold code the mod runs and is never walked into. Only a regular file is
// read, through a link too: anything else (a pipe, whose read would wait for a writer, a link
// that leads nowhere or back to itself, a file the file system refuses) is listed with no text.
const isCode = (file) => file.endsWith(".js") && !file.endsWith(".test.js");
const isFile = (path) => orIfRefused(() => stat(path)?.isFile() === true, false);
const textOf = (path) => (isFile(path) ? orIfRefused(() => readFileSync(path, "utf8"), null) : null);
export const codeIn = (folder) =>
  filesBelow(folder)
    .filter((file) => isCode(file) || !isFile(join(folder, file)))
    .map((file) => ({ file, text: isCode(file) ? textOf(join(folder, file)) : null }));

// Where code names a mod: a mod key's value, key and value quoted any way and spaced any way,
// or the mod's folder. A mod whose name only starts with it, such as its clone, is not it.
// The clones' own tests look for the shipped mod each stands in for with it.
export const namesMod = (mod) => {
  const name = RegExp.escape(mod);
  return new RegExp(`\\bmod["'\`]?\\s*:\\s*["'\`]${name}["'\`]|mods/${name}/`);
};

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
