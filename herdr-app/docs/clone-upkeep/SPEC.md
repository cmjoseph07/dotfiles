# Spec: Herdr clone upkeep

Status: approved 2026-11-24.
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
    drift.js                         pure: which snapshots differ from the shipped files
    drift.test.js                    node --test
  mods/spaces-cards/model.js         clean follows the agents list; hidden bare repo name
  mods/spaces-cards/model.test.js    tying test, emoji rows, bare repo rows
  mods/agents-context/main.js        the four 0.1.18 changes, by merge
  mods/*/mod.json, layouts/cards.json   cloned_from.version
```

A snapshot's path under `upstream/` is the shipped file's path under `herdr-app/`.

| Clone | Snapshot (merge base) | Shipped |
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

# What Herdr changed since the version taken (prints nothing when nothing did)
(cd herdr-app && for f in mods/spaces/main.js mods/spaces/mod.json mods/agents/main.js mods/agents/mod.json layouts/main.json; do
  diff -u "upstream/$f" "$f"
done; ls mods/spaces mods/agents)

# Take one file: clone, snapshot, shipped. The exit code is the number of conflicts.
git merge-file herdr-app/mods/agents-context/main.js herdr-app/upstream/mods/agents/main.js herdr-app/mods/agents/main.js

# Move the snapshots to the version taken
(cd herdr-app && for f in mods/spaces/main.js mods/spaces/mod.json mods/agents/main.js mods/agents/mod.json layouts/main.json; do
  mkdir -p "upstream/$(dirname "$f")" && cp "$f" "upstream/$f"
done)

# The version the clones name (one line: the same version three times)
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

Run it when the drift test reports a skip.
One uptake takes the clones from the version the snapshots hold to the version the app is at, however many releases lie between.

1. **Read.**
   Diff each snapshot against its shipped file, and list the shipped mod folders for a file a release added.
2. **Decide.**
   Every change is taken unless the clone has no place for it: the clone no longer draws or does the thing the change is about.
   A change that is skipped is named in this spec's decisions log with the reason.
3. **Merge.**
   For each pair whose shipped file changed: `git merge-file <clone> <snapshot> <shipped>`.
   A conflict is resolved by hand in the clone.
   A change to code the clone has moved elsewhere (from `spaces-cards/main.js` into `model.js`) is carried there by hand, with a unit test.
   A file a release added to a shipped mod is copied into the clone when the clone needs it.
   It gets a snapshot whether or not the clone takes it: a shipped file with no snapshot keeps the drift test skipping.
   The new snapshot needs its own exception in the repo's `.gitignore` and a line in the two file loops in Commands.
4. **Follow.**
   When the `clean` rule in `agents-context/main.js` changed, `clean` in `spaces-cards/model.js` takes the same regex.
   The tying test is red until it does.
5. **Stamp.**
   Copy all five shipped files over their snapshots, and set `cloned_from.version` to `herdr-app --version` in both `mod.json` files and `layouts/cards.json`.
   All three move together on every uptake, whichever files changed: the version says what `upstream/` holds.
6. **Prove.**
   Unit tests, `herdr-app check` on both mods, `herdr-app status` and no `*.error` file, then the live window for every taken change that draws.
7. **Commit.**
   The clone changes, the snapshots and the version go in one commit, so the tree never holds a clone ahead of or behind its snapshot.
   Add a decisions log entry here: the version, what was taken, what was skipped and why.

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
| `✋ Needs input` | Needs input | Needs input |
| `⏳ Waiting on CI` | Waiting on CI | Waiting on CI |
| `✳ Fix the login redirect` | Fix the login redirect | Fix the login redirect |
| `⠋ - Thinking about cards` | Thinking about cards | Thinking about cards |
| `[ ! ] Review the diff` | Review the diff | Review the diff |
| `[web] login` | [web] login | [web] login |

The "after" column was produced by running the shipped 0.1.18 regex over these titles on 2026-11-24.
The rest of the rule is unchanged: a path, the terminal's address, the program's name or key, and anything with an `@` are still not telling.
A title that is only an emoji is now telling, as it is in the agents list.

### Drift test

`upstream/drift.js` exports one pure function that takes the snapshot folder and the app folder and returns what differs, by shipped mod or layout name.
A name differs when one of its snapshot files is not byte-for-byte the shipped file, or when a shipped file has no snapshot: the layout file, or anything in its shipped mod folder that is not a folder, other than `gpui-kit.d.ts`, `jsconfig.json` and `.DS_Store`.
A snapshot file whose shipped file is gone from a mod folder that is still shipped differs too.
Bytes are read only from two regular files: anything else where a file was, on either side (a folder, a pipe whose read would wait), differs and is never read.
A name whose files or folders the file system refuses to look at (no permission, a link that leads back to itself) differs as well: what cannot be read cannot be shown to be its snapshot.

`upstream/drift.test.js` runs it against the real folders, one test per name (`spaces`, `agents`, `main`):

| Shipped files | The test |
|---|---|
| Same as the snapshot | Passes |
| Differ, or a file was added | Is skipped, with a message that names what changed and points here: `spaces changed in Herdr since 0.1.18: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md` |
| Absent: the shipped mod folder, or the shipped layout file, is not there (a machine without the Herdr app) | Passes and says nothing |

The version in the message is read from the clone's `cloned_from.version`.

It is never a red failure: the app updates itself, and a red test after an update would block work that has nothing to do with the clones.
The test run in Commands prints every skip, so the message is seen on the next run after an update.

The same file tests the function itself against temporary folders (same, one byte changed, a file added, an app-written file added, shipped files absent), and those tests fail red like any other.

### Tying test

In `spaces-cards/model.test.js`:

- Read `../agents-context/main.js` as text, take the regex literal out of its `const clean =` line, and assert it equals the regex `model.js` cleans with, pattern and flags.
- Do the same for the two regex literals on its `const path =` line: the path test and the status glyph strip before it, which `tellingTitle` copies as well.
- When a line or its literal cannot be found, the test fails: a rule that moved is a rule to look at.
- The `tellingTitle` behavior table stays and gains the emoji rows above.

Both files are tracked, so this test runs on every machine and fails red.
After an uptake that changes `clean` in `agents-context` and not in `model.js`, it is the failing test that says so.

### Changes to the card sidebar documents

- `docs/card-sidebar/SPEC.md` keeps `Status: done`.
- Its "Keeping the clones current" section shrinks to a pointer to this spec; the heading stays, so the README's link still lands.
- Its open questions 3 and 4 are struck through and closed by reference to this spec.
- Its decisions log gets one dated entry saying so.
- The repo `README.md` line on `herdr-app/` names `upstream/` among what is tracked and links the upkeep to this spec.

## Code style

As in the card sidebar spec: pure decisions in modules Node can import, tests next to the code, no comment that restates the code, plain dash only.

```js
// model.js - the regex is the shipped agents list's, kept equal by a test
const CLEAN = /^(?:\[ [!.] \] |[✋⏳]️?(?=\s)|(?!(?:\p{Emoji}️|[#*]⃣))[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}])+/u;
const clean = (s) => plain(s).replace(CLEAN, "").trim();

// drift.test.js - a skip that says what to do, never a failure
for (const name of ["spaces", "agents", "main"]) {
  test(`shipped ${name} is the version taken`, (t) => {
    if (changed.includes(name)) t.skip(`${name} changed in Herdr since ${taken}: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md`);
  });
}
```

Snapshots are never edited: they are written only by `cp` from the shipped file.

## Testing strategy

| Level | What | How |
|---|---|---|
| Unit | Emoji rows and status marks in `tellingTitle`; the hidden bare repo name beside the existing name cases in `gitInfo` | `node --test`, `spaces-cards/model.test.js` |
| Unit | The tie between the title rule's regexes in the two mods: `clean`, the path test and its glyph strip | `node --test`, `spaces-cards/model.test.js` |
| Unit | `drift` against temporary folders; the three live tests | `node --test`, `upstream/drift.test.js` |
| Mutation | The tying test and the drift test do fail or skip when they should | in a scratch copy: change one regex alone, then one shipped byte, and run |
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

1. `agents-context/main.js` holds the four 0.1.18 changes: its `const clean =` line is byte-for-byte the shipped one, and the clone still opens its own sort menu (`mod: "agents-context"`, one occurrence).
2. Running the merge again (`git merge-file -p` of the clone, the 0.1.18 snapshot and the shipped file) gives the clone back unchanged.
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

## Open questions

1. ~~**Tie the path test as well?**~~
   Settled 2026-11-24 at approval: yes, see the decisions log and Tying test.
2. ~~**Assumptions 5 and 6.**~~
   Settled 2026-11-24 at approval: both stand.
