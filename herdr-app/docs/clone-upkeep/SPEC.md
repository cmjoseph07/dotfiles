# Spec: Herdr clone upkeep

Status: done 2026-11-24 (approved 2026-11-24).
Source: grill session of 2026-11-24, decisions Q1 to Q5 and Q20.
Builds on: [card sidebar spec](../card-sidebar/SPEC.md), status done.
Lands before card sidebar v2.

## Objective

The `cards` layout runs on three clones of shipped Herdr files: the mods `spaces-cards` and `agents-context`, and the layout `cards.json`.
Herdr replaces its own files on every update and never touches a clone, so each clone keeps the code of the version it was made from.
The clones were made from 0.1.16, the app is now 0.1.18, and nothing but a hand-run diff says so.

Two things are wrong with the upkeep as it stands:

- The re-diff always starts at commit `9a7be8c` (0.1.16), so it lists changes already taken along with new ones, and every change is carried by hand.
- `tellingTitle` in `spaces-cards/model.js` is a hand copy of the title rule in the agents list, and no test ties the two.
  Since 0.1.18 they differ: the agents list keeps a title's leading emoji and the cards drop it.

This work does three things:

1. Takes every Herdr 0.1.18 change that still has a place in the clones.
2. Makes the uptake a repeatable procedure for every later release: a tracked snapshot of the shipped files as the merge base, a three-way merge, and a test that says when Herdr has moved on.
3. Ties the cards' title rule to the agents list's with a test.

0.1.18 is the first run of the procedure.

### User stories

1. As the user, a title that starts with an emoji reads the same on a space card and in the agents list.
2. As the user, a space in a repo kept as `<project>/.bare` shows the project's name on its card, not `.bare`.
3. As the user, the agents list in the `cards` layout behaves as the shipped 0.1.18 one does, plus the context readout.
4. As the user, after a Herdr update I am told by the test run which mod changed, without anything turning red.
5. As the user, taking a release is one merge per changed file against the last version taken, not a re-read of everything since 0.1.16.

### Out of scope

- Card sidebar v2.
- The emoji avatar and the emoji-aware repo and branch tail of the shipped `spaces` mod: the cards draw neither.
- Any new behavior in the clones beyond what Herdr shipped.
- Running the uptake automatically: a person or an agent decides what each change means for the clone.
- Snapshots of shipped files that have no clone (`worktree`, `menu`, the other layouts).
- Any new keybinding or command to remember.

## Assumptions

1. Herdr app 0.1.18 (`herdr-app --version`, checked 2026-11-24), macOS, Node 26.
2. The shipped `spaces` and `agents` mods each hold `main.js` and `mod.json` beside the two files the app writes into every mod folder (`gpui-kit.d.ts`, `jsconfig.json`); checked 2026-11-24.
3. The app leaves a folder it does not know alone: `herdr-app/docs/` has been there since 2026-11-23 and came through the update to 0.1.18 untouched.
   `herdr-app/upstream/` is taken to be safe the same way.
4. Commit `9a7be8c` holds each clone as `mod.clone` first wrote it from 0.1.16.
   `mod.clone` rewrites a mod's own name in self-opening overlays, so the clone is the shipped file with that name changed, not a byte copy (see the first run).
5. The drift test and what it needs live in `herdr-app/upstream/` beside the snapshots.
   The grill settled that it is a unit test, not where it lives.
6. The drift test also reports a file a release added to a shipped mod folder, which the old procedure caught with `ls`.
   The grill named only the comparison with the snapshots; this keeps what the old procedure covered.

5 and 6 were confirmed at approval on 2026-11-24.

## Tech stack

- Merge: `git merge-file` (git 2.x, already required by the mods).
- Tests: `node --test` (Node 26, built in, no dependencies).
- Snapshots: byte copies made with `cp`.
- JSON checks: `jq`.

## Project structure

```
herdr-app/
  docs/clone-upkeep/SPEC.md          this file
  upstream/                          shipped Herdr files at the version taken
    mods/spaces/main.js              pristine snapshot
    mods/spaces/mod.json             pristine snapshot
    mods/agents/main.js              pristine snapshot
    mods/agents/mod.json             pristine snapshot
    layouts/main.json                pristine snapshot
    drift.js                         which snapshots differ from the shipped files, and what each live test does
    drift.test.js                    node --test; one version in the clones; no shipped mod in layouts/cards.json
  mods/spaces-cards/model.js         clean follows the agents list; hidden bare repo name
  mods/spaces-cards/model.test.js    tying test, emoji rows, bare repo rows
  mods/spaces-cards/clone.test.js    no shipped spaces name in its code
  mods/agents-context/main.js        the four 0.1.18 changes, by merge
  mods/agents-context/clone.test.js  the tied lines are the snapshot's; the sort menu's own name, no shipped agents name in its code
  mods/*/mod.json, layouts/cards.json   cloned_from.version
```

A snapshot's path under `upstream/` is the shipped file's path under `herdr-app/`.

| Clone | Snapshot (base) | Shipped |
|---|---|---|
| `mods/spaces-cards/main.js` | `upstream/mods/spaces/main.js` | `mods/spaces/main.js` |
| `mods/spaces-cards/mod.json` | `upstream/mods/spaces/mod.json` | `mods/spaces/mod.json` |
| `mods/agents-context/main.js` | `upstream/mods/agents/main.js` | `mods/agents/main.js` |
| `mods/agents-context/mod.json` | `upstream/mods/agents/mod.json` | `mods/agents/mod.json` |
| `layouts/cards.json` | `upstream/layouts/main.json` | `layouts/main.json` |

The repo's `.gitignore` tracks `herdr-app/upstream/` with the same care as the mod folders: only the five snapshots, `drift.js` and `drift.test.js`.

## Commands

All paths are relative to `~/.config`.
The blocks are bash and zsh syntax; fish does not run them.

```sh
# Unit tests: one run per folder. A folder with 0 tests fails, and every skip is printed.
(for dir in mods/spaces-cards mods/agents-context upstream; do
  out=$(node --test --test-reporter=tap "herdr-app/$dir/") && ! grep -qx '# tests 0' <<<"$out" \
    || { echo "$out"; echo "FAIL $dir"; exit 1; }
  echo "$dir: $(grep -x '# pass [0-9]*' <<<"$out")"
  grep '# SKIP' <<<"$out" || true
done)

# What Herdr changed since the version taken: a diff per snapshot, then the files of the shipped mod folders, at any depth,
# that have no snapshot (>) or whose snapshot has no shipped file (<). Prints nothing when nothing changed.
# gpui-kit.d.ts and jsconfig.json are written by the app, .DS_Store by Finder: none is a shipped file.
(cd herdr-app && for f in mods/spaces/main.js mods/spaces/mod.json mods/agents/main.js mods/agents/mod.json layouts/main.json; do
  diff -u "upstream/$f" "$f"
done
diff <(cd upstream && find mods/spaces mods/agents ! -type d ! -name .DS_Store | sort) \
  <(find mods/spaces mods/agents ! -type d ! -name gpui-kit.d.ts ! -name jsconfig.json ! -name .DS_Store | sort))

# Merge agents-context/main.js: clone, snapshot, shipped, into a scratch file. The exit code is the number of conflicts.
git merge-file -p herdr-app/mods/agents-context/main.js herdr-app/upstream/mods/agents/main.js herdr-app/mods/agents/main.js > /tmp/agents-context.main.js
# With any conflict resolved there: the lines the merge changed in the clone are the lines Herdr changed (prints nothing when so).
diff <(diff <(cat herdr-app/mods/agents-context/main.js) <(cat /tmp/agents-context.main.js) | grep '^[<>]' | sort) \
  <(diff <(cat herdr-app/upstream/mods/agents/main.js) <(cat herdr-app/mods/agents/main.js) | grep '^[<>]' | sort)
# Then, once read, copy it over the clone: the live mod is written once, whole.
cp /tmp/agents-context.main.js herdr-app/mods/agents-context/main.js

# The shipped title rule run over titles, for the title table's "after": per title, what the shipped clean leaves,
# then "path" when the shipped path test rejects the title. Both are the shipped lines, run as they are (the titles are examples).
node -e '
const src = require("fs").readFileSync("herdr-app/mods/agents/main.js", "utf8");
const clean = new Function(`return ${src.match(/^const clean = .*?\.replace\((\/.+\/[a-z]*), ""\)/m)[1]}`)();
const path = new Function("l", `return ${src.match(/^\s*const path = (.*\.test\(.*\));$/m)[1]}`);
for (const t of process.argv.slice(1)) console.log([t, t.replace(clean, "").trim(), path({ title: t }) ? "path" : ""].join("\t"));
' '🔴 login' '✋ Needs input' '✳ ~/code/app'

# The clone's own changes, before and after: per pair, the lines the clone holds that its snapshot does not and the reverse,
# as committed (<) and as now (>). Run after the stamp, before the commit. Prints nothing when every pair holds the same lines.
# Each printed line is old (<) or now (>), then a snapshot line (<) or a clone line (>): "> <" is a Herdr line the clone does not take.
# JSON is read without cloned_from and with sorted keys, and lines are sorted: Apple's diff lines up repeated lines
# one way for a file and another for a pipe, so an unsorted compare prints lines that did not change.
(cd herdr-app
own() { case $1 in *.json) jq -S 'del(.cloned_from)' ;; *) cat ;; esac; }
while read -r clone shipped; do
  git cat-file -e "HEAD:herdr-app/$clone" 2>/dev/null || { echo "== $clone: new in this uptake, nothing committed to compare"; continue; }
  out=$(diff <(diff <(git show "HEAD:herdr-app/upstream/$shipped" | own "$shipped") <(git show "HEAD:herdr-app/$clone" | own "$clone") | grep '^[<>]' | sort) \
    <(diff <(own "$shipped" < "upstream/$shipped") <(own "$clone" < "$clone") | grep '^[<>]' | sort))
  [ -z "$out" ] || printf '== %s\n%s\n' "$clone" "$out"
done <<'EOF'
mods/spaces-cards/main.js mods/spaces/main.js
mods/spaces-cards/mod.json mods/spaces/mod.json
mods/agents-context/main.js mods/agents/main.js
mods/agents-context/mod.json mods/agents/mod.json
layouts/cards.json layouts/main.json
EOF
)

# Move the snapshots to the version taken
(cd herdr-app && for f in mods/spaces/main.js mods/spaces/mod.json mods/agents/main.js mods/agents/mod.json layouts/main.json; do
  mkdir -p "upstream/$(dirname "$f")" && cp "$f" "upstream/$f"
done)

# Set cloned_from.version in the three clones to the version the app is at (only that line changes)
v=$(herdr-app --version | awk '{print $2}')
for j in herdr-app/mods/spaces-cards/mod.json herdr-app/mods/agents-context/mod.json herdr-app/layouts/cards.json; do
  out=$(jq --arg v "$v" '.cloned_from.version = $v' "$j") && printf '%s\n' "$out" > "$j"
done

# The version the clones name (the same version on three lines)
jq -r '.cloned_from.version' herdr-app/mods/spaces-cards/mod.json herdr-app/mods/agents-context/mod.json herdr-app/layouts/cards.json

# Load check and errors, as in the card sidebar spec
herdr-app check herdr-app/mods/spaces-cards
herdr-app check herdr-app/mods/agents-context
herdr-app status
find herdr-app -name '*.error'
herdr-app shot /tmp/herdr-cards.png
```

## Behavior

### The uptake procedure

Run it when the unit test run in Commands prints a `# SKIP` line under `upstream`: a drift test naming the shipped mod or layout that changed.
One uptake takes the clones from the version the snapshots hold to the version the app is at, however many releases lie between.
The version the snapshots hold is what "The version the clones name" in Commands prints; the version the app is at is the second word of `herdr-app --version`.
Each step names its command in Commands by the command's first comment line.

Before step 1:

- `git status --porcelain herdr-app` prints nothing: the Prove step compares with `HEAD`, and the commit takes whole files.
  Other work in progress there is committed or set aside first, with its owner's say.
- The Herdr window is live and redraws from these files: a save under `mods/` or `layouts/` reloads it at once, and a broken save keeps the last good version and writes a `*.error` file.
  So no clone file is saved half done, with conflict markers or importing a file not there yet.
  `herdr-app check` runs after each save in a mod folder; a layout save is checked with `herdr-app status`.
- Shots go to one folder for the uptake, one file each: `mkdir -p /tmp/uptake-<version>` first, as `herdr-app shot` makes no folder, then `herdr-app shot /tmp/uptake-<version>/<what>-before.png`, and `-after.png` in step 6.

1. **Read.**
   Run "What Herdr changed": a diff of each snapshot against its shipped file, then each file a release added to a shipped mod folder (`>`) or removed from one (`<`).
   Read Herdr's notes for every version after the one taken, in `herdr-app/update-notes-cache.md` (written by the app), else in What's new (`herdr-app do app.whats_new`): they say what a change is for, which a diff does not.
2. **Decide.**
   Every change is taken unless the clone has no place for it: the clone no longer draws or does the thing the change is about.
   A change that is skipped is named in this spec's decisions log with the reason; skipping one that does have a place is asked first.
   A change to a line the clone changed on purpose is still taken: the clone keeps its own intent and takes what of Herdr's change still applies.
   Before anything is written, each change that draws is captured as the window shows it now: once a clone is saved, the window shows only the new code.
   What a capture needs on screen is staged outside `~/.config`: a throwaway git repo, a space opened on it, and a terminal in that space, as AGENTS.md's "The model" says.
   Afterwards the space is closed (`space.close --confirmed true`), which ends its terminals, and the repo is removed.
3. **Merge.**
   The pairs are the table in Project structure.
   `agents-context/main.js` is merged, with "Merge agents-context/main.js": into a scratch file, any conflict resolved there, then its check, which prints nothing when the merge changed the clone's lines exactly as Herdr changed its own.
   Each hunk of the merge is also read where it landed: a hunk can land, with no conflict, in code of the clone's own that only looks like Herdr's.
   A change that merged cleanly but was decided against is taken back out of the scratch file by hand, and only then is the scratch file copied over the clone.
   `spaces-cards/main.js`, both `mod.json` files and `layouts/cards.json` are carried by hand, change by change from step 1's diff, never merged.
   `spaces-cards/main.js` is rewritten past a merge's reach (330 of its 756 lines are not its snapshot's, where `agents-context/main.js` has 34 of 501), so a merge can put a hunk in the wrong function with no conflict; the JSON files' format and key order are not their snapshots', so a merge conflicts on any change.
   Shipped code the cards carry in `model.js` is marked by its comments ("Herdr's rule", "the shipped agents list's"): the repo name in `gitInfo` and the title rule's three regexes; a change to it is carried there, with a unit test.
   Taken code that names a shipped mod the clones stand in for names the clone instead: `mod: "agents"` becomes `mod: "agents-context"`, `mods/agents/` becomes `mods/agents-context/`, the same for `spaces` and `spaces-cards`, and a layout block's `"mod"` the same way.
   A shipped name left in is red: each clone's `clone.test.js` fails while a `.js` file the clone runs (its tests aside) names the shipped mod it stands in for (`mod: "agents"` or `mods/agents/` in `agents-context`, `mod: "spaces"` or `mods/spaces/` in `spaces-cards`), and `drift.test.js` fails while a block of `layouts/cards.json` opens `spaces` or `agents`.
   The clone's own name is not counted: a taken overlay that opens the clone, renamed, needs no test change.
   A file a release added to a shipped mod folder is copied into the clone when the clone needs it, before the clone file that uses it is saved.
   It gets a snapshot whether or not the clone takes it: a shipped file with no snapshot keeps the drift test skipping.
   Its path joins the file lists of "What Herdr changed" and "Move the snapshots", so the stamp copies it.
   A clone file taken from it is a new pair: in "The clone's own changes", and in the tree, the table and the `.gitignore` sentence of Project structure.
   In the repo's `.gitignore` the snapshot needs its own exception after `herdr-app/upstream/mods/*/*` (`!herdr-app/upstream/mods/<mod>/<file>`), and the clone's copy one after `herdr-app/mods/*/*` unless it is a top-level `*.js`, `*.svg` or `mod.json`.
   A file in a subfolder needs three lines instead: `!<mod folder>/<folder>/`, `<mod folder>/<folder>/*` and `!<mod folder>/<folder>/<file>`.
   `git check-ignore <path>` prints nothing for each.
   A file a release removed leaves every list above and its `.gitignore` exception, and its snapshot is removed with `git rm`; the clone keeps its copy only if it still uses it, and deletes it only after the clone file that used it is saved.
4. **Follow.**
   When a regex of the title rule changed in `agents-context/main.js`, `spaces-cards/model.js` takes it: the regex of the `const clean =` line is `CLEAN`, and the two on the `const path =` line that holds `.test(` are `PATH` and `PATH_GLYPH`.
   Each is copied as the clone spells it, escapes included: the tying test compares the source.
   The tying test in `model.test.js` is red until it does, and `clone.test.js` is red from the merge until the stamp.
   A `tellingTitle` row that pinned the old rule takes the new value, and a case of the new regex that no row shows gets one, in `model.test.js` and in the title table under "The title rule on the cards".
   "The shipped title rule" gives each "after", never typed: what the shipped `clean` leaves, unless it prints `path`.
   A title the path test rejects, or that is the terminal's address, its program's name or key, or holds an `@`, is not telling: its "after" is "none (falls to the branch)".
   In the table, "before" takes the old "after", and the line under the table names the version.
5. **Stamp.**
   First read `herdr-app --version` again: if it is not the version step 1 read, the app updated itself meanwhile, and the uptake goes back to step 1 with the clones as they are now.
   Then "Move the snapshots" copies every shipped file over its snapshot, and "Set cloned_from.version" sets the version in both `mod.json` files and `layouts/cards.json`.
   All three move together on every uptake, whichever files changed: the version says what `upstream/` holds.
   Saving `cards.json` reloads the shown layout: no `layout.error` appears, and only what step 3 took changes on screen.
6. **Prove.**
   "The clone's own changes" compares, for every pair, the clone's own changes against the new snapshot with those against the old one.
   Each line it prints is read against step 1's diff, and is one of these:
   - a Herdr change skipped or carried elsewhere, with any clone line that matched only the old line;
   - a taken line renamed to the clone's name;
   - a clone line a taken change touched, such as a conflict resolved by hand or a comma after a JSON key.
   Skips, carries and conflicts are named in the log entry; anything else is a change of the clone's that the uptake lost.
   Running the merge again is no check: once the snapshot is the shipped file, it gives the clone back whatever the merge did.
   Then:
   - The unit test run passes with no `# SKIP` line, and "What Herdr changed" prints nothing.
   - `herdr-app check` prints `check passed` for both mods; its `WARN ... stranded script tasks` lines are the check ending the mod, and the shipped mods print them too.
   - `herdr-app status` lists `"errors": []`, and no `*.error` file exists.
   - The window, on the `cards` layout, shows each taken change that draws: captured again with `herdr-app shot` and compared with its "before" at full size.
     The scratch repos, spaces and terminals made for it are removed afterwards.
7. **Commit.**
   Add the decisions log entry first: the version, what was taken, what was skipped and why, what was carried elsewhere, and each conflict resolved by hand.
   One commit then holds the clone files, `model.js` and its tests, the snapshots, the three versions, any `.gitignore` change, and this spec's edits, so the tree never holds a clone ahead of or behind its snapshot.
   This spec's edits are the log entry, the title table when the rule changed, and Commands' lists and Project structure when a file was added or removed.
   Stage the files by name, never a folder, a removed one with `git rm`, and commit as `feat(herdr-app): take Herdr <version> into the clones`; nothing is pushed.

The snapshots replace commit `9a7be8c` as the baseline.
After an uptake the diff in step 1 is empty, so the next one lists only what is new.

### The first run: 0.1.16 to 0.1.18

There is no snapshot yet, so the merge base for this run is made from commit `9a7be8c`.

- `agents-context/main.js`: the base is `9a7be8c`'s file with the sort menu's `mod: "agents-context"` turned back to `mod: "agents"`.
  That is the shipped 0.1.16 file as `mod.clone` found it.
  With that base the merge is clean and keeps the clone's own name; dry run on 2026-11-24: 0 conflicts, 20 lines of the clone change.
  With `9a7be8c`'s file as it is, the merge is also clean and silently writes `mod: "agents"` into the clone, so its sort menu would open the shipped mod.
- `spaces-cards/main.js`: nothing is merged.
  Its three shipped changes are one taken in `model.js` and two skipped, and a merge of the file gives 4 conflicts that would all resolve to the clone's side.
- `mod.json` of both mods and the layout: unchanged by Herdr between 0.1.16 and 0.1.18.

Taken in `agents-context` (all four, by the merge):

| Change | What the user sees |
|---|---|
| `clean` keeps a leading emoji | A title such as "🔴 login" keeps its emoji in the agents list; known status marks are still dropped |
| A kept sub-agent shows its own status | A sub-agent that was given a pane keeps its own status on its row, done included |
| A kept helper's done does not rank its parent | Nothing new: a working parent stays under Working when a kept helper finishes, as in 0.1.16, now that the helper's own row shows done |
| Narrow rail row | The row is rounded, and lit when its agent is focused |

Taken in `spaces-cards` (by hand, in `model.js`):

- The hidden bare repo name: a repo kept as `<project>/.bare` is named after its project folder.
  `gitInfo` names a repo by Herdr's rule: the folder holding `.git`, else the folder holding `.bare`, else the folder's own name without a trailing `.git`.

Skipped in `spaces-cards`:

- The whole leading emoji as the avatar: a card's avatar is the first letter or digit of its first line (`avatarLetter`).
- The repo and branch tail hidden when it matches the name without its emoji: a card has no such tail.

The snapshots committed with this run are the shipped 0.1.18 files.

### The title rule on the cards

`tellingTitle` in `spaces-cards/model.js` cleans a title with the same regex as `clean` in `agents-context/main.js`, applied after `plain` as today.

| Terminal title | Card title before | Card title after |
|---|---|---|
| `🔴 login` | login | 🔴 login |
| `❤️ deploy` | deploy | ❤️ deploy |
| `· 🔴 login` | login | 🔴 login |
| `🇩🇪 release` | release | 🇩🇪 release |
| `🚀` | none (falls to the branch) | 🚀 |
| `#⃣ deploy` | deploy | #⃣ deploy |
| `✋Needs` | Needs | ✋Needs |
| `✋ Needs input` | Needs input | Needs input |
| `✋️ Needs input` (`✋` then U+FE0F) | Needs input | Needs input |
| `⏳ Waiting on CI` | Waiting on CI | Waiting on CI |
| `✳ Fix the login redirect` | Fix the login redirect | Fix the login redirect |
| `⠋ - Thinking about cards` | Thinking about cards | Thinking about cards |
| `[ ! ] Review the diff` | Review the diff | Review the diff |
| `[web] login` | [web] login | [web] login |

The "after" column was produced by running the shipped 0.1.18 regex over these titles on 2026-11-24.
The keycap, `✋Needs` and `✋️ Needs input` rows were added later that day, each for a branch of the regex no other row shows; their "before" is the `tellingTitle` of the commit before the uptake, run over them.
The rest of the rule is unchanged: a path, the terminal's address, the program's name or key, and anything with an `@` are still not telling.
A title that is only an emoji is now telling, as it is in the agents list.

### Drift test

`upstream/drift.js` exports `drift`, a function that takes the snapshot folder and the app folder, changes nothing, and returns what differs, by shipped mod or layout name.
It also exports the live tests' `verdict`, below, and `CLONE_OF`, the clone file of each name.
A name differs when one of its snapshot files is not byte-for-byte the shipped file, or when a shipped file has no snapshot: the layout file, or anything in its shipped mod folder that is not a folder, other than `gpui-kit.d.ts`, `jsconfig.json` and `.DS_Store`.
A link is one entry, a link to a folder too: a mod folder is listed one level at a time and only its real folders are gone down into, so a link is never walked into.
A snapshot file whose shipped file is gone from a mod folder that is still shipped differs too.
Bytes are read only from two regular files of one size: anything else where a file was, on either side (a folder, a pipe whose read would wait), differs and is never read, and so does another size, which spares reading a file too large for Node to read whole (over 2 GiB).
A name whose files or folders the file system refuses to look at (no permission, a link that leads back to itself, a path below a file) differs as well: what cannot be read cannot be shown to be its snapshot.

`upstream/drift.test.js` runs it against the real folders, one test per name (`spaces`, `agents`, `main`):

| Shipped files | The test |
|---|---|
| Same as the snapshot | Passes |
| Differ, a file was added, or a link that leads nowhere is where the mod folder or layout file was | Is skipped, with a message that names what changed and points here: `spaces changed in Herdr since 0.1.18: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md` |
| Absent: the shipped mod folder, or the shipped layout file, is not there (a machine without the Herdr app) | Passes and says nothing |

The version in the message is read from the clone's `cloned_from.version`.
What a live test does is one function, `verdict` in `drift.js`: pass, skip with the message, or throw, red, when a clone file cannot be read or names no version, which is this repo's fault and never Herdr's.
Beside the live tests, one test checks that the three clones name one version, and one that the cards layout opens no shipped mod the clones stand in for (see Tying test).

It is never a red failure: the app updates itself, and a red test after an update would block work that has nothing to do with the clones.
The test run in Commands prints every skip, so the message is seen on the next run after an update.

The same file tests `drift` and `verdict` themselves against temporary folders (same, one byte changed, a file added, an app-written file added, shipped files absent, a bad clone file), and those tests fail red like any other.
The cases where the file system refuses a read are skipped when run as root, which no permission refuses.

### Tying test

In `spaces-cards/model.test.js`:

- Read `../agents-context/main.js` as text, take the regex literal out of its `const clean =` line, and assert it equals the regex `model.js` cleans with, pattern and flags.
- Do the same for the two regex literals on its `const path =` line: the path test and the status glyph strip before it, which `tellingTitle` copies as well.
- When a line or its literal cannot be found, the test fails: a rule that moved is a rule to look at.
- The `tellingTitle` behavior table stays and gains the emoji rows above.

Both files are tracked, so this test runs on every machine and fails red.
After an uptake that changes `clean` in `agents-context` and not in `model.js`, it is the failing test that says so.

In `agents-context/clone.test.js`, the other end of the tie:

- The clone's `const clean =` line and its `.test(` `const path =` line are byte-for-byte the same lines of the `agents` snapshot: an uptake that moves the snapshots without merging is red.
  Between an update and its uptake the snapshot is still the clone's version, so a Herdr change alone never makes it red.
- The clone's sort menu, each line holding `sortMenu: true` and at least one, opens `mod: "agents-context"`, and no `.js` file the clone runs (its tests aside, which read the snapshot under the shipped name) holds `mod: "agents"` or `mods/agents/`: the merge that writes the shipped name back has no conflict to say so.
  The clone's own name may occur any number of times, and so may the line that opens its sort menu.

The clones' names are tested where they are carried by hand too, where nothing else would see a shipped name left in:

- `spaces-cards/clone.test.js`: no `.js` file the clone runs (its tests aside) holds `mod: "spaces"` or `mods/spaces/`.
- `upstream/drift.test.js`, beside the version check: no block of `layouts/cards.json`, at any depth (pane headers and floating blocks included), opens `spaces` or `agents`.

### Changes to the card sidebar documents

- `docs/card-sidebar/SPEC.md` keeps `Status: done`.
- Its "Keeping the clones current" section shrinks to a pointer to this spec.
  The heading stays because the card sidebar plan and that spec's decisions log name the section.
- Its open questions 3 and 4 are struck through and closed by reference to this spec.
- Its decisions log gets one dated entry saying so.
- The repo `README.md` line on `herdr-app/` names `upstream/` among what is tracked and links the upkeep to this spec.

## Code style

As in the card sidebar spec: pure decisions in modules Node can import, tests next to the code, no comment that restates the code, plain dash only.

```js
// model.js - the regex is the shipped agents list's, kept equal by a test
const CLEAN = /^(?:\[ [!.] \] |[✋⏳]️?(?=\s)|(?!(?:\p{Emoji}️|[#*]⃣))[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}])+/u;
const clean = (s) => plain(s).replace(CLEAN, "").trim();

// drift.js - a skip that says what to do, never a failure
return drift(snapshots, app).includes(name) ? `${name} changed in Herdr since ${taken}: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md` : null;

// drift.test.js
for (const name of Object.keys(CLONE_OF)) {
  test(`shipped ${name} is the version taken`, (t) => {
    const skip = verdict(SNAPSHOTS, APP, name);
    if (skip) t.skip(skip);
  });
}
```

Snapshots are never edited: they are written only by `cp` from the shipped file.

## Testing strategy

| Level | What | How |
|---|---|---|
| Unit | Emoji rows and status marks in `tellingTitle`; the hidden bare repo name beside the existing name cases in `gitInfo` | `node --test`, `spaces-cards/model.test.js` |
| Unit | The tie between the title rule's regexes in the two mods: `clean`, the path test and its glyph strip | `node --test`, `spaces-cards/model.test.js` |
| Unit | The tied lines of `agents-context` against its snapshot; its sort menu's own name; no `mod: "agents"` or `mods/agents/` in its code | `node --test`, `agents-context/clone.test.js` |
| Unit | No `mod: "spaces"` or `mods/spaces/` in the code of `spaces-cards` | `node --test`, `spaces-cards/clone.test.js` |
| Unit | `drift` and `verdict` against temporary folders; the three live tests; one version in the three clones; no block of `layouts/cards.json` opens `spaces` or `agents` | `node --test`, `upstream/drift.test.js` |
| Mutation | The tying test, the drift test and the clones' names do fail or skip when they should | in a scratch copy: change one regex alone, then one shipped byte, then put a shipped name into a clone or the layout, and run |
| Load | Each mod loads and renders once | `herdr-app check <mod>` after every edit |
| End to end | The real window | `herdr-app shot`, inspected at full size |

End to end states that must be captured and reviewed:

1. An agent whose title starts with an emoji: the card's title and the agents row both show the emoji.
2. The narrow rail with a focused agent: its row rounded and lit.
3. A space in a worktree of a scratch repo kept as `<project>/.bare`: line 1 of the card reads the project's name.

The kept sub-agent's status and the helper's done are shipped code taken by a clean merge and are checked by reading the merged diff against Herdr's own; they are captured live only if a sub-agent can be staged without a pointer.
Scratch repos, spaces and agents made for these captures are removed afterwards.

## Boundaries

Always:

- Run the unit tests and `herdr-app check` after every edit, and confirm no `*.error` file exists.
- Work only in the two clones, `layouts/cards.json`, `herdr-app/upstream/`, `herdr-app/docs/`, and the `herdr-app` entries of the repo's `.gitignore` and `README.md`.
- Commit a clone change, its snapshot and the version together.
- Record every skipped Herdr change in the decisions log with its reason.
- Fix lint, test failures and visual defects seen along the way, even when not caused by this work.

Ask first:

- Skipping a Herdr change that does have a place in the clone.
- Restarting the app.
- Any change to `keys.json` or `settings.json`.
- Pushing.

Never:

- Edit shipped mods, shipped layouts, `AGENTS.md` or the `.d.ts` files.
- Edit a snapshot by hand, or commit one that is not a byte copy of the shipped file.
- Let the drift test fail red on a Herdr change.
- Weaken or delete the tying test to get to green.
- Commit app-written state.

## Success criteria

1. `agents-context/main.js` holds the four 0.1.18 changes: its `const clean =` line is byte-for-byte the shipped one, and the clone still opens its own sort menu (each `sortMenu: true` line opens `mod: "agents-context"`, and no file it runs holds `mod: "agents"`).
2. The clone's own changes to `agents-context/main.js` against the 0.1.18 snapshot are the same lines as against the 0.1.16 base it was merged from: the command in Commands, with the base built from `9a7be8c` and the clone of the commit before the uptake as its "before", prints nothing.
3. `tellingTitle` gives the "after" column of the title table, and every row of the existing table still passes.
4. The tying test passes, and fails when any of the three tied regexes is changed on one side alone (shown once each, then restored).
5. `gitInfo` names a repo at `/x/proj/.bare` `proj`, and the existing name cases still pass.
6. `cloned_from.version` reads `0.1.18` in both `mod.json` files and `layouts/cards.json`.
7. The five files under `herdr-app/upstream/` are byte-for-byte the shipped 0.1.18 files (`cmp`), and are tracked.
8. The drift tests pass with no skip on this machine; against a scratch copy with one changed byte the test is skipped with a message naming the mod, exit code 0; with the shipped files absent it passes with no message.
9. The unit test run in Commands passes for all three folders, both mods pass `herdr-app check`, `herdr-app status` reports no errors, no `*.error` file exists.
10. The three end to end states are captured and show no clipped text, misaligned rows or theme-foreign colors.
11. `docs/card-sidebar/SPEC.md` still reads `Status: done`, its "Keeping the clones current" section is a pointer to this spec, and its open questions 3 and 4 are closed.
12. A dry read of the uptake procedure against 0.1.18 needs no step that is not written here.
13. Commits on `main`, not pushed.

## Decisions log

- 2026-11-24 (grill Q1 to Q5, Q20): The eight settled decisions this spec is written from: take every 0.1.18 change that has a place; `tellingTitle` follows the new `clean`; a tying test on the regex literal; `cloned_from.version` to 0.1.18 in all three files; tracked snapshots under `herdr-app/upstream/` with `git merge-file`; a drift test that skips and never fails; the procedure repeats for every release; the card sidebar spec stays done and points here.
- 2026-11-24 (spec): The first run's merge base for `agents-context/main.js` is `9a7be8c`'s file with the clone's own name turned back.
  Found by dry run: with the file as committed, the merge is clean and reverts the sort menu to the shipped mod's name, with no conflict to warn of it.
  Later runs do not have the problem: the snapshot is the shipped file, so the clone's name is a change on the clone's side only.
- 2026-11-24 (spec): `spaces-cards/main.js` is not merged in the first run.
  The clone has moved the repo name into `model.js` and draws neither the avatar emoji nor the tail, so all 4 conflicts would resolve to the clone's side.
- 2026-11-24 (spec): `cloned_from.version` is the version the snapshots were copied from, one value for all three clones.
  It is no longer what says an uptake is due; the drift test is.
- 2026-11-24 (spec): The test run prints skips.
  The loop in the card sidebar spec printed only the pass count, which would have hidden the drift message.
- 2026-11-24 (approval): The tying test also covers the two regexes on the `const path =` line, as recommended.
  This widens grill decision 3, which named only `clean`: `tellingTitle` copies all three by hand, and Herdr changing the path test alone would otherwise go unseen.
  The drift test lives in `herdr-app/upstream/` and reports files a release adds to a shipped mod folder.
- 2026-11-24 (plan, Task 1): A shipped file with no snapshot differs, for the layout as for a mod.
  This spec says so only for a file in a shipped mod folder; `drift.js` reads `layouts/main.json` the same way, and a snapshot file whose shipped file is gone from a mod folder that is still shipped differs too.
  A snapshot deleted by accident then can never pass in silence, and before the first uptake, with no snapshot in the tree, all three live tests skip with `since 0.1.16`: an uptake is due.
  "Absent" is only the shipped mod folder, or the shipped layout file, not being there at all.
- 2026-11-24 (Checkpoint A build, approved): `.DS_Store` is not a shipped file either.
  Finder leaves one in any folder it showed, so opening a shipped mod folder would have been reported as a Herdr change.
  `drift.js` skips the three names at any depth, on both sides.
- 2026-11-24 (Checkpoint A review): Three findings of the review, written in.
  A link in a shipped mod folder counts as a file: `drift.js` skipped everything that was not a regular file, so a link a release added went unseen.
  A file a release adds gets a snapshot whether or not the clone takes it, with its own `.gitignore` exception and a line in the two file loops: the `.gitignore` tracks only the five snapshots, so the new one would have stayed untracked and the test would skip on every other checkout.
  The Drift test section now states the whole rule of the Task 1 entry above, not only the mod folder half.
- 2026-11-24 (Checkpoint A ship review, built as Task 3a): `drift` compares only when both sides are files.
  It read any path that existed, so a folder where a file was threw `EISDIR`, and a throw in a live test is the red failure on a Herdr change this spec forbids.
  It could not be reached before the first uptake: with no snapshot in the tree no pair was read.
- 2026-11-24 (Checkpoint B build, approved): `drift` never throws on what the file system refuses.
  A shipped file or folder without read permission still threw `EACCES` after Task 3a, seen red in five temporary folder cases.
  Any error of a file system call while a name is compared now counts as that name differing; any other error is a fault in `drift.js` and still throws.
  This holds for the snapshot side too: an unreadable snapshot is reported as a skip, and the uptake's `cp` over it is where it shows.
  A shipped file that is now a link leading back to itself is one such error (`ELOOP`), with its own cases.
- 2026-11-24 (plan, Task 6): `model.js` spells the `clean` regex as Herdr does, with the `\uFE0F` and `\u20E3` escapes, not with the raw characters of the code sample in Code style.
  The tying test compares `source`, which keeps the spelling, so the two would not compare equal otherwise.
  The three regexes are exported as `CLEAN`, `PATH` and `PATH_GLYPH`, and the test builds its side from the literal's text in `agents-context/main.js`: it checks the regex that runs, not a second copy.
  It also fails when the line is gone or doubled, or holds another count of regexes.
- 2026-11-24 (uptake, 0.1.16 to 0.1.18): The first run, as "The first run" above says.
  Taken in `agents-context/main.js` by one clean merge, 0 conflicts and 20 changed lines, the same lines as Herdr's own diff: `clean` keeps a leading emoji, a kept sub-agent shows its own status, a kept helper's done does not rank its parent, the narrow rail row is rounded and lit when focused.
  Taken in `spaces-cards/model.js` by hand: `clean` follows the agents list, and `gitInfo` names a repo kept as `<project>/.bare` after its project folder.
  Skipped in `spaces-cards`: the whole leading emoji as the avatar, because a card's avatar is the first letter or digit of its first line, and the repo and branch tail hidden when it matches the name without its emoji, because a card has no such tail.
  `spaces-cards/main.js` was not merged, and both `mod.json` files and the layout were unchanged by Herdr.
  The five snapshots are the shipped 0.1.18 files, and `cloned_from.version` reads `0.1.18` in all three clones.
- 2026-11-24 (Checkpoint B review): Four findings of the review, written in.
  A shipped folder the file system refuses to look at differs: `drift.js` asked `existsSync`, which reads a refusal as "not there", so the names below it passed in silence; it now asks `statSync`, inside the catch, and "absent" is only a path that is not there.
  The check that both sides are regular files is kept for what the catch cannot do: a read of a pipe waits for a writer, and the test would hang, not fail.
  The cases for that rule, for a link that leads back to itself, and for an error that is not the file system's now each fail when their guard is removed; before, three of the guards could go unseen.
  The third row of the agents list's changes said a helper's done no longer pulls its parent out of Working; 0.1.16 already ranked a kept helper's done as idle, and the 0.1.17 notes list only the done shown on its own row.
- 2026-11-24 (Checkpoint B ship review, built as Task 10a): Two guards of the repeatable uptake were missing, and `drift` had three paths that were slow, silent or red.
  `agents-context/clone.test.js` ties the clone's two tied lines to the `agents` snapshot, so an uptake that moves the snapshots without merging is red, and checks the sort menu's own name; `drift.test.js` checks that the three clones name one version.
  `drift` lists a mod folder one level at a time and goes down only into real folders: Node's recursive listing walked into a link to a folder, 2.3 s for a link to a tree of 725,000 entries where it now takes 1 ms.
  Two cases pin it: two links back to their own folder, which Node's walk never finished, and a folder turned into a link to an equal folder, which a walk that follows links passes as the same.
  It no longer follows a link to say whether a shipped name is there, so a link that leads nowhere where the layout or a mod folder was differs, where it passed as absent.
  It compares sizes before reading: Node reads no file over 2 GiB whole, and that error is not the file system's, so it was thrown, red.
  A pipe on either side is tested against an empty file, which sizes cannot tell from it, so each half of the regular-file check fails a test when removed; the entry above claimed that, and only the shipped half held it.
  What a live test does is now `verdict`, unit tested, so its message and its red path on a bad clone file are no longer proven by hand only; the no-permission cases skip when run as root.
  Three title rows show the `clean` branches no row showed: a keycap, a status mark with U+FE0F, and a status mark with no space after it.
  Criterion 2 and the Prove step now compare the clone's own changes before and after the merge: running the merge again cannot fail once the snapshot is the shipped file.
  Accepted as they are: a title that starts with an emoji that looks like a status dot loses it, as in Herdr's own 0.1.18 rule, and `RANK[s]` in `agents-context/main.js` is reached by no word like `constructor`.
- 2026-11-24 (Task 12, dry read): A fresh agent that had seen none of this work walked the procedure against 0.1.18, running only read-only commands and simulating a release in a scratch folder.
  Its gaps, and the steps the Phase B build took that the procedure did not say, are written into the procedure and Commands.
  One was a fault: the Prove command printed 6 lines for `spaces-cards/main.js` with nothing changed, because Apple's diff lines up repeated lines one way for a file and another for a pipe.
  It now reads both sides the same way, sorts the lines, reads JSON without `cloned_from` and with sorted keys, and runs over every pair from one list.
  Shown in a scratch clone of the repo with a release simulated: it prints nothing for a clean merge and a change carried by hand, and prints a skipped change and a lost clone name.
  `mod.json` and `layouts/cards.json` are carried by hand: their format and key order are not their snapshots', so a merge conflicts on any change.
  "What Herdr changed" compares the shipped mod folders' files at any depth with the snapshots and prints nothing when nothing changed; its `ls` printed both folders every time, which its own comment denied.
  From the Phase B build: the release notes read, the "before" captures taken before the first write, the merge into a scratch file before the live clone, and the app's version read again before the stamp.
  From the dry read: when to run it and from what tree, the pairs, the clone's own names in taken code, the `.gitignore` lines of an added file for its snapshot and its clone copy, a removed file, all three tied regexes in Follow and which tests are red until when, the version command, what `check`, `status` and the window must show, and what the commit holds, how it is staged and named.
  A second fresh agent then walked the written procedure the same way, write steps included in a scratch clone of the repo, and found two more that would have gone wrong.
  A clean merge of `spaces-cards/main.js` put a shipped hunk into a function of the clone's own, with no conflict and nothing printed by Prove: that file is now carried by hand like the JSON files, and the `agents-context` merge is checked against Herdr's own changed lines (the Phase B check of Task 5) and read hunk by hunk.
  Renaming a taken overlay to the clone's name would turn `clone.test.js` red for good, as it counts the name once: the count now moves with it, in the same commit.
  Its other findings are written in too: shots one file each, staging and removing a capture's space, the order of writes for an added or removed file, the `.gitignore` lines for a subfolder, what `model.js` carries, a command for the title table's "after", what each kind of line Prove prints means, and what the commit holds.
  A third fresh agent, asked only for what would leave the result wrong, ran three simulated releases through every step, write steps included, and found two: "The shipped title rule" ran only `clean`, so a path row's "after" was wrong and its test red, and "What Herdr changed" did not leave out a `.DS_Store` among the snapshots, which `drift` does.
  The command now runs the shipped path line too, and the snapshot side leaves `.DS_Store` out; `herdr-app shot` makes no folder, so the shots' folder is made first.
  The heading of the card sidebar spec's "Keeping the clones current" stays because the card sidebar plan and decisions log name that section; the README links here.
- 2026-11-24 (Task 12a, from Task 12's second dry read): The clones' names are tested where each is carried, and the clone's own name is no longer counted.
  `clone.test.js` counted `mod: "agents-context"` exactly once, so a taken overlay that opens its own mod, renamed as step 3 says, turned it red until the count was moved by hand; this replaces that rule of the Task 12 entry above.
  It now checks that the line holding `sortMenu: true` opens `mod: "agents-context"`, and that no `.js` file the clone runs holds `mod: "agents"` or `mods/agents/`.
  Nothing caught a shipped name left in `spaces-cards` or in the layout, both carried by hand: `spaces-cards/clone.test.js` checks its files for `mod: "spaces"` and `mods/spaces/`, and `drift.test.js` checks that no block of `layouts/cards.json`, at any depth, opens `spaces` or `agents`.
  The scans read subfolders too and leave the tests out: `clone.test.js` reads the snapshot under the shipped name.
  Each passed on the tree and was seen red in a scratch copy, in only the test that names the fault: a shipped name on the sort menu line, on another line, in a file in a subfolder, in each clone, and in a layout block and a pane header; a second `mod: "agents-context"` turned nothing red.
- 2026-11-24 (Checkpoint C review): Three findings of the review, written in, each seen red in a scratch copy with its fault put in.
  `verdict` holds a version to three numbers, as the old live test did, and no test failed with that rule removed: a clone naming `latest` now throws in a test.
  A path below a file, `layouts` or `mods` shipped as a file, differs: `exists` asks `lstatSync`, which throws there, where `statSync` had no stat and the name passed as absent.
  The comment above `exists` said the opposite; it is kept as it runs, as nothing odd where a shipped name should be passes as absent, and two cases pin it.
  Task 12a's sort menu check still counted its line once, the failure it removed for the clone's name: a release with a second opener, renamed as step 3 says, would be red for good.
  Each line holding `sortMenu: true` opens `mod: "agents-context"` now, and at least one must.
  Answered, unchanged: a snapshot folder that is not there stays out of the catch, as "no snapshot yet" is a state, not a refusal; `mod: 'agents'` in single quotes is not looked for, as taken code is Herdr's, which writes `mod: "x"`; a version with a pre-release tail would be red, a rule older than this review.

## Open questions

1. ~~**Tie the path test as well?**~~
   Settled 2026-11-24 at approval: yes, see the decisions log and Tying test.
2. ~~**Assumptions 5 and 6.**~~
   Settled 2026-11-24 at approval: both stand.
