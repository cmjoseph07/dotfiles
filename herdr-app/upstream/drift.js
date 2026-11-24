// Which shipped Herdr mods and layouts differ from their snapshots. No herdr or gpui-kit
// import, so Node can test it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Never Herdr's sources: the app writes the first two into every mod folder, and Finder
// leaves the third in any folder it showed.
const NOT_SHIPPED = ["gpui-kit.d.ts", "jsconfig.json", ".DS_Store"];

// Whatever is not a folder counts as a file, a link included.
const sources = (folder) =>
  existsSync(folder)
    ? readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter((entry) => !entry.isDirectory() && !NOT_SHIPPED.includes(entry.name))
        .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    : [];

const same = (snapshot, shipped) =>
  existsSync(snapshot) && existsSync(shipped) && readFileSync(snapshot).equals(readFileSync(shipped));

// Every file on either side counts, so a file a release added or dropped is a difference.
const modDiffers = (snapshot, shipped) =>
  [...sources(snapshot), ...sources(shipped)].some((file) => !same(join(snapshot, file), join(shipped, file)));

const layoutDiffers = (snapshot, shipped) => !same(snapshot, shipped);

// A snapshot's path in the snapshot folder is the shipped path in the app folder.
const SHIPPED = {
  spaces: { path: "mods/spaces", differs: modDiffers },
  agents: { path: "mods/agents", differs: modDiffers },
  main: { path: "layouts/main.json", differs: layoutDiffers },
};

// The names whose shipped files are not byte-for-byte their snapshots. A name the app
// folder does not ship (a machine without the Herdr app) is not reported.
export const drift = (snapshots, app) =>
  Object.entries(SHIPPED)
    .filter(([, { path, differs }]) => existsSync(join(app, path)) && differs(join(snapshots, path), join(app, path)))
    .map(([name]) => name);
