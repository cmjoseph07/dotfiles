# Implementation plan: Herdr clone upkeep

Spec: [SPEC.md](SPEC.md), approved 2026-11-24.
Status: approved 2026-11-24, Phase A built 2026-11-24 (Tasks 1 to 3), Checkpoint A shipped 2026-11-24, Phase B built 2026-11-24 (Tasks 3a to 10), Checkpoint B shipped 2026-11-24, Task 10a added 2026-11-24 from its ship review, Task 10a built 2026-11-24, Task 11 built 2026-11-24, Task 12 built 2026-11-24, Task 12a added 2026-11-24 from its dry read, Task 12a built 2026-11-24, Checkpoint C tested 2026-11-24, Checkpoint C reviewed 2026-11-24, Checkpoint C shipped 2026-11-24; the plan is done.
Task list target: this file (the project keeps spec, plan and tasks together under `herdr-app/docs/clone-upkeep/`, not in `tasks/`).

## Overview

Take Herdr 0.1.18 into the three clones as the first run of a repeatable uptake: tracked snapshots as the merge base, `git merge-file`, a drift test that skips when Herdr has moved on, and a test that ties the cards' title rule to the agents list's.
Three checkpoints: the drift tooling, the uptake itself, the documents with the fixes the uptake's ship review found.
Each ends in test, review and one ship commit on `main`, not pushed.

## Architecture decisions

- **The snapshots are not in the scaffold commit.**
  The clones are at 0.1.16 until the uptake, and a tree with 0.1.18 snapshots beside them would hold every clone behind its snapshot.
  So Checkpoint A ships the tooling with no snapshot, and Checkpoint B ships the five snapshots, every clone change and the version in one commit, as the spec's step 7 asks.
- **A shipped file with no snapshot differs, for a layout as for a mod.**
  The spec says so for a file in a shipped mod folder; the plan reads it the same way for `layouts/main.json`.
  With that, a snapshot deleted by accident can never pass in silence, and at Checkpoint A the three live tests skip with `... changed in Herdr since 0.1.16`, which is true: an uptake is due.
  Checkpoint B turns those three skips into passes.
- **`drift.js` knows the three names** (`spaces`, `agents`, `main`) and takes the two folders.
  For a mod it compares every file on either side except `gpui-kit.d.ts`, `jsconfig.json` and `.DS_Store`; for the layout, the one file.
  "Absent" means the shipped mod folder, or the shipped layout file, does not exist: that name is not reported.
- **`model.js` exports the three tied regexes as named constants**, and the tying test compares each with a `RegExp` built from the literal's text in `agents-context/main.js`, `source` and `flags`.
  The test then checks the regex that runs, not a second copy of its text.
  `model.js` writes the `clean` literal as Herdr does, with `\uFE0F` and `\u20E3` escapes: `source` keeps the spelling, so the raw characters shown in the spec's code sample would not compare equal.
- **The mutation checks run on scratch copies**, never on the tracked files.
  A save in a mod folder reloads the live window this work runs inside, and a scratch tree needs no restore.
  The tests find their neighbours by relative path, so a copy of `mods/spaces-cards`, `mods/agents-context`, `upstream/`, the shipped files and `layouts/cards.json` under one scratch folder runs unchanged.
- **The merge is written to a scratch file first** (`git merge-file -p`), checked, and only then run in place.
- **End to end states are staged in a scratch repo** (`~/Development/scratch/upkeep-e2e`, kept as `upkeep-e2e/.bare` with one worktree), never in a real repo.
  It, its spaces and its terminals are removed before Checkpoint B ships.

## Dependency graph

```
T1 drift function ──> T2 live drift tests ──> T3 track upstream/, three-folder loop
                                                │
                                   ── Checkpoint A (no snapshot yet) ──
                                                │
T3a drift never throws on a folder ──> T8       │
T4 stage and capture "before"                   │
T5 merge 0.1.18 into agents-context ──> T6 clean follows, tying test ──> T7 hidden bare repo name
                                                                            │
                                    T8 stamp: five snapshots, version, log entry
                                         ├──> T9 mutation checks
                                         └──> T10 captures "after", cleanup
                                                │
                                   ── Checkpoint B (one uptake commit) ──
                                                │
T10a ship review's gaps closed ──> T12          │
                              T11 card sidebar documents, README ──> T12 dry read, closing sweep
                                                                       └──> T12a the clones' own names, tested
                                                │
                                   ── Checkpoint C ──
```

Highest risk first inside each phase: T1 settles the drift rule everything else leans on, T5 is the one step that can silently rename the clone's sort menu.

## What every checkpoint runs

1. **Test:** the three-folder unit test loop from the spec's Commands section (fails on a failed test and on a folder with 0 tests, prints every skip), `herdr-app check` on both mods, `herdr-app status` with no errors, no `*.error` file, `herdr-app shot` reviewed at full size.
2. **Review:** five-axis review of the checkpoint's diff by a fresh `agent-skills:code-reviewer`, findings fixed or answered, then a simplification pass.
3. **Ship:** one commit on `main` with the message listed at the checkpoint, no push, no co-author line.
   The commit carries its own ticks and the status line of this file.
4. **Report:** what was done and proven, then stop and ask for approval.
   Build, test, review and ship are each their own step with their own stop.

## Task list

### Phase A: Drift tooling

- [x] **Task 1: The `drift` function** (S)
  - Description: Write `upstream/drift.js`, one pure function that takes the snapshot folder and the app folder and returns the names that differ, tests first against temporary folders.
    No `herdr` or `gpui-kit` import, no dependency.
  - Acceptance:
    - Temporary folder cases, each a red-capable test: same (nothing reported), one byte changed (that name), a file added to a shipped mod folder (that name), an app-written file added (`gpui-kit.d.ts`, `jsconfig.json`: nothing), shipped files absent (nothing).
    - Also: a shipped file with no snapshot is reported, for a mod and for the layout; one changed mod does not report the other two names.
    - Every temporary folder is removed by its test.
  - Verify: `node --test herdr-app/upstream/` passes; each case was seen red before `drift.js` satisfied it.
  - Dependencies: none.
  - Files: `upstream/drift.js`, `upstream/drift.test.js`.
  - Criteria: 8 (the function).

- [x] **Task 2: The live drift tests** (S)
  - Description: In the same test file, one test per name against the real folders, located from the test file's own path.
    A changed name is skipped with `<name> changed in Herdr since <version>: run the uptake in herdr-app/docs/clone-upkeep/SPEC.md`, the version read from that name's clone (`spaces-cards/mod.json`, `agents-context/mod.json`, `layouts/cards.json`).
    It never fails red on a Herdr change.
  - Acceptance:
    - With no snapshot yet, the run exits 0 and prints three skips that each name their mod or layout and `0.1.16`.
    - The message is byte-for-byte the spec's form.
    - A clone file that cannot be read fails red: that is this repo's fault, not Herdr's.
  - Verify: `node --test --test-reporter=tap herdr-app/upstream/` shows three `# SKIP` lines and exit code 0.
  - Dependencies: Task 1.
  - Files: `upstream/drift.test.js`.
  - Criteria: 8 (skip and message), user story 4.

- [x] **Task 3: Track `upstream/` and run the three-folder loop** (XS)
  - Description: Add the `herdr-app/upstream/` entries to the repo's `.gitignore` with the same care as the mod folders: only the five snapshot paths, `drift.js` and `drift.test.js`.
    Run the spec's three-folder loop as the unit test command from here on.
  - Acceptance:
    - `git status --short --untracked-files=all herdr-app/upstream` lists `drift.js` and `drift.test.js` and nothing else.
    - `git check-ignore` reports a stray file in `upstream/`, in `upstream/mods/spaces/` (`gpui-kit.d.ts`) and in `upstream/layouts/` as ignored, and each of the five snapshot paths as not ignored.
    - The loop prints one pass line for each of `mods/spaces-cards`, `mods/agents-context` and `upstream`, then the three skips.
    - The app has written nothing into `upstream/` (`ls -la`), and `herdr-app status` lists no error.
  - Verify: the commands above, the stray files removed afterwards.
  - Dependencies: Task 2.
  - Files: `../.gitignore`.
  - Criteria: 9 (the loop), 7 (tracking rules).

### Checkpoint A: Drift tooling

- [x] Test, review, ship as above.
- [x] Commit: `feat(herdr-app): add the drift test for the clones' upstream`.
  It also carries `docs/clone-upkeep/SPEC.md` and this plan, untracked until now.
- [x] The three live tests skip with `since 0.1.16` and nothing is red; no snapshot is in the tree.
- [x] `git status` shows nothing of this work left uncommitted; `git log origin/main..main` shows the commit unpushed.

### Phase B: The first uptake, 0.1.16 to 0.1.18

The tasks follow the spec's procedure in order: read and decide are done in the spec, then merge (T5, T7), follow (T6), stamp (T8), prove (T9, T10), commit (Checkpoint B).
Before anything: `herdr-app --version` must still read `0.1.18`; if the app has updated itself, stop and report.
Task 3a comes first: it is a fix to Phase A's `drift.js` that the ship review of Checkpoint A found, and it must be in before the snapshots are.

- [x] **Task 3a: `drift` reports a folder where a file was, and never throws** (XS)
  - Description: Found by the ship review of Checkpoint A on 2026-11-24: `same` in `upstream/drift.js` reads any path that exists, so a folder on either side of a compared path throws `EISDIR`.
    A throw in a live test is a red failure on a Herdr change, which the spec forbids.
    Tests first, then `same` compares only when both sides are files (`statSync(path, { throwIfNoEntry: false })?.isFile()`); anything else differs.
  - Acceptance:
    - Red first, each a temporary folder case: a snapshot file whose shipped path is now a folder reports that mod; a shipped file whose snapshot path is a folder reports that mod; `layouts/main.json` shipped as a folder, with its snapshot present, reports `main`.
    - No case throws, and the 26 unit tests of Checkpoint A pass untouched.
    - It lands before Task 8: with no snapshot in the tree the throw cannot be reached.
    - Added at the build's approval on 2026-11-24: nothing the file system refuses makes `drift` throw.
      A shipped file or folder without read permission still threw `EACCES`; any error of a file system call while a name is compared now counts as that name differing.
  - Verify: the three-folder loop, with `upstream` passing 26 plus the new cases and the three skips still naming `0.1.16`.
  - Dependencies: Checkpoint A.
  - Files: `upstream/drift.js`, `upstream/drift.test.js`.
  - Criteria: 8 (never red on a Herdr change).

- [x] **Task 4: Stage the end to end states and capture them before the uptake** (S)
  - Description: Make the scratch repo `~/Development/scratch/upkeep-e2e` as `.bare` plus one worktree, open a space in the worktree, and stage an agent in it whose title starts with an emoji (`🔴 login`).
    Capture what the user sees today.
  - Acceptance:
    - A shot shows the card's first line reading `.bare`.
    - A shot shows the emoji-titled agent: its card title and its agents row both without the emoji.
    - A shot of the narrow rail with that agent focused, its row square and unlit; the sidebar width read beforehand is put back.
  - Verify: `herdr-app shot` for each, inspected at full size; `herdr-app ls` shows the scratch space.
  - Dependencies: none.
  - Files: none in the repo.
  - Criteria: 10 (the "before" half).

- [x] **Task 5: Merge 0.1.18 into `agents-context/main.js`** (S)
  - Description: Build the base in a scratch folder: `9a7be8c`'s `agents-context/main.js` with `mod: "agents-context"` turned back to `mod: "agents"`.
    Merge to a scratch file with `git merge-file -p`, check it, then run `git merge-file` in place: clone, base, shipped.
  - Acceptance:
    - The base differs from `9a7be8c`'s file in exactly one line, and from the shipped file in the four hunks only (20 changed lines; planning dry run 2026-11-24).
    - The merge exits 0 with no conflict marker and changes 20 lines of the clone.
    - The clone's `const clean =` line is byte-for-byte the shipped one; `mod: "agents-context"` occurs once and `mod: "agents"` not at all.
    - The changed lines of the clone are the changed lines of Herdr's own diff: this is the check of the kept sub-agent's status and the helper's done.
  - Verify: `diff` of the two change lists is empty; `grep -c` for both names; `cmp` of the two `const clean =` lines; `herdr-app check herdr-app/mods/agents-context`; `agents-context` unit tests; `herdr-app status`.
    The tying test does not exist yet, so nothing is red here.
  - Dependencies: Checkpoint A.
  - Files: `mods/agents-context/main.js`.
  - Criteria: 1, user story 3.

- [x] **Task 6: `clean` follows the agents list, with the tying test** (M)
  - Description: Tests first in `model.test.js`: the seven emoji and status mark rows of the spec's title table beside the existing rows, and the tying test on the `const clean =` literal and the two literals of the `const path =` line.
    Then `model.js` takes the shipped 0.1.18 regex for `clean`, applied after `plain`, and names the path test and its glyph strip as constants; all three are exported.
  - Acceptance:
    - Red first: the tying test fails on `clean` and the five emoji rows fail against today's `model.js`, which is the spec's step 4 seen live.
    - `tellingTitle` gives the whole "after" column, and every existing `tellingTitle` test still passes untouched.
    - The tying test fails when a line or its literal is not found exactly once.
      `agents-context/main.js` holds a second `const path =` line (the feed path), so the test takes the one that holds `.test(`.
  - Verify: the unit test loop; `herdr-app check herdr-app/mods/spaces-cards`; no `*.error` file.
  - Dependencies: Task 5.
  - Files: `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.
  - Criteria: 3, 4 (passes), user story 1.

- [x] **Task 7: The hidden bare repo name in `gitInfo`** (S)
  - Description: Tests first: a repo at `/x/proj/.bare` is named `proj`, beside the existing name cases.
    Then `gitInfo` names a repo by Herdr's rule: the folder holding `.git`, else the folder holding `.bare`, else the folder's own name without a trailing `.git`.
  - Acceptance:
    - The new row is red before the change and green after.
    - The existing name cases (`/code/lanternhall/.git`, `/code/lanternhall.git`, the odd characters row) pass untouched.
  - Verify: the unit test loop; `herdr-app check herdr-app/mods/spaces-cards`.
  - Dependencies: Task 6 (same files).
  - Files: `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.
  - Criteria: 5, user story 2.

- [x] **Task 8: Stamp: the five snapshots, the version, the log entry** (S)
  - Description: Check `herdr-app --version` again, then run the spec's `cp` loop for the five shipped files, set `cloned_from.version` to `0.1.18` in both `mod.json` files and `layouts/cards.json`, and add the 0.1.18 entry to the spec's decisions log: what was taken, what was skipped and why.
    `spaces-cards/main.js` is not merged, as the spec's first run says.
  - Acceptance:
    - `cmp` is silent for each of the five snapshot and shipped pairs.
    - The spec's `jq` command prints `0.1.18` three times.
    - The three live drift tests pass with no skip.
    - `git merge-file -p` of the clone, the new `agents` snapshot and the shipped file gives the clone back unchanged.
    - The window still shows `cards` as before the layout file was saved: no `layout.error`, sizes and clicks kept.
  - Verify: the commands above; the unit test loop; both `herdr-app check` runs; `herdr-app status`; a shot.
  - Dependencies: Tasks 3a, 5 to 7.
  - Files: `upstream/mods/spaces/main.js`, `upstream/mods/spaces/mod.json`, `upstream/mods/agents/main.js`, `upstream/mods/agents/mod.json`, `upstream/layouts/main.json`, `mods/spaces-cards/mod.json`, `mods/agents-context/mod.json`, `layouts/cards.json`, `docs/clone-upkeep/SPEC.md`.
  - Criteria: 2, 6, 7, 8 (no skip on this machine).

- [x] **Task 9: Mutation checks** (S)
  - Description: In a scratch copy of the tree, show that each guard does fail or skip when it should.
  - Acceptance:
    - The tying test fails three times, once for each tied regex changed on one side alone: `clean`, the path test, the glyph strip.
    - With one byte changed in the scratch copy's shipped `spaces/main.js`, the live test for `spaces` is skipped with the message naming `spaces` and `0.1.18`, the other two pass, exit code 0.
    - With the scratch copy's shipped files removed, all three pass and print no message.
    - With the scratch copy's `mods/spaces-cards/mod.json` removed, the live test for `spaces` fails red and the other two do not: the proof by hand of Checkpoint A, repeated, as no unit test covers it.
    - `git status` shows no tracked file touched; the scratch copy is removed.
  - Verify: the outputs of the six runs, quoted in the checkpoint report.
  - Dependencies: Task 8.
  - Files: none in the repo.
  - Criteria: 4 (fails), 8 (skip, absent).

- [x] **Task 10: Capture the three states after the uptake, then clean up** (S)
  - Description: Capture the same three states as Task 4 against the new code, compare each with its "before", then remove everything staged.
  - Acceptance:
    - State 1: the card's title and the agents row both show `🔴 login`.
    - State 2: the narrow rail's row for the focused agent is rounded and lit.
    - State 3: line 1 of the scratch space's card reads `upkeep-e2e`.
    - No clipped text, misaligned row or theme-foreign color in any of the three, at full size.
    - The scratch repo, its space and its terminals are gone (`herdr-app ls`, `hc ls`, `ls ~/Development/scratch`), and the sidebar is back at its earlier width.
  - Verify: the three shots, paths in the checkpoint report; the kept sub-agent and the helper's done are captured only if a sub-agent can be staged without a pointer, else they rest on Task 5's diff check.
  - Dependencies: Tasks 4, 8.
  - Files: none in the repo.
  - Criteria: 10, user stories 1 to 3.

### Checkpoint B: The uptake

- [x] Test, review, ship as above.
- [x] Commit: `feat(herdr-app): take Herdr 0.1.18 into the clones`.
  One commit holds the merged `agents-context/main.js`, `model.js` and its tests, the five snapshots, the three version stamps, the spec's log entry and Task 3a's fix to `drift.js` with its tests.
- [x] `git ls-files herdr-app/upstream` lists seven files: the five snapshots, `drift.js`, `drift.test.js`.
- [x] Criteria 1 to 10 demonstrated, each with its command output or shot.
- [x] Not pushed.

### Phase C: Documents and close

Task 10a comes first: it closes the gaps the ship review of Checkpoint B found, and Task 12's closing sweep checks the criteria with it in.

- [x] **Task 10a: Close the ship review's gaps in `drift` and the ties** (M)
  - Description: Found by the ship review of Checkpoint B on 2026-11-24 (code reviewer, security auditor, test engineer).
    Nothing is wrong at 0.1.18, but two guards of the repeatable uptake are missing, and `drift` has three paths that are slow, silent or red.
    Tests first for each item; the spec's wording and decisions log follow.
  - Acceptance:
    - `drift` (`upstream/drift.js`):
      - A link to a folder inside a shipped mod folder is one entry, compared as a file and never walked into: `sources` lists one level at a time and goes down only into real folders.
        Shown in a scratch folder, as no unit test can time it: a link to a large tree is reported in milliseconds, where today it takes seconds.
      - A dangling link where the shipped layout file or a shipped mod folder should be is reported, not taken as absent: `exists` asks `lstatSync`, and only `isFile` follows links.
      - A shipped file over 2 GiB is reported, never thrown: sizes are compared before any byte is read (a sparse file made by the test).
      - A pipe on the snapshot side is reported without a read, so each half of the regular-file check fails a test when removed.
      - The existing link, loop and permission cases pass untouched.
    - Ties:
      - The clone's `const clean =` line and its `.test(` `const path =` line equal the same lines of `upstream/mods/agents/main.js`: an uptake that moves the snapshots without the merge is red.
      - `mods/agents-context/main.js` holds `mod: "agents-context"` once and `mod: "agents"` never, in a test file beside `context.test.js` (the count replaced by Task 12a).
      - The three `cloned_from.version` values are equal.
    - Other tests:
      - The live tests' verdict (pass, skip with the spec's message, red on an unreadable clone file) is one function, unit tested on temporary folders, so the message and the red path are no longer proven by hand only.
      - Three title rows for the `clean` branches with no example: `#⃣ deploy`, `✋️ Needs input`, `✋Needs`, each "after" value produced by running the shipped regex (the spec's "The shipped title rule"), not written by hand; added to the spec's title table too.
      - `drift.test.js:47` asserts that the changed file differs from the shipped one, not that its length is kept.
      - The no-permission cases skip when run as root, where permissions do not apply.
    - Spec:
      - Criterion 2 and the Prove step name a check that can fail: the clone's own changes against the new snapshot are the same lines as against the old one, or each difference is a conflict resolved by hand and named in the log.
        Running the merge again cannot fail once the snapshot is the shipped file.
      - The Drift test section says a link is never walked into, and the Checkpoint B review entry's "each fail when their guard is removed" holds.
      - One decisions log entry for this task.
    - Out of scope, accepted at the ship of Checkpoint B: a title starting with an emoji that looks like a status dot (Herdr's own 0.1.18 rule), and `RANK[s]` in `agents-context/main.js` (nothing reaches it with a word like `constructor`).
  - Verify: the three-folder loop, with more passes than 176, 20 and 47 and no skip; each new test seen red first, or, where today's tree already passes it (the two ties, the equal versions), red in a scratch copy with the fault put in; both `herdr-app check` runs; `herdr-app status`; no `*.error` file.
  - Dependencies: Checkpoint B.
  - Files: `upstream/drift.js`, `upstream/drift.test.js`, `mods/spaces-cards/model.test.js`, a new test file in `mods/agents-context/`, `docs/clone-upkeep/SPEC.md`.
  - Criteria: 1, 2, 4, 6, 8.

- [x] **Task 11: Point the card sidebar documents here** (S)
  - Description: In `docs/card-sidebar/SPEC.md`, shrink "Keeping the clones current" to a pointer to this spec under the same heading, strike through open questions 3 and 4 and close them by reference, and add one dated decisions log entry.
    In the repo `README.md`, the `herdr-app/` line names `upstream/` among what is tracked and links the upkeep to this spec.
  - Acceptance:
    - Line 3 of the card sidebar spec still reads `Status: done`.
    - The heading `## Keeping the clones current` is still there, so `#keeping-the-clones-current` resolves, and no `9a7be8c` re-diff command is left under it.
    - Open questions 3 and 4 are struck through; 5 (hand checks) is untouched.
    - Every relative link in the three documents resolves to a file that exists.
  - Verify: `grep` for the heading, the status line and the struck questions; each link target checked with `test -e`.
  - Dependencies: Checkpoint B.
  - Files: `docs/card-sidebar/SPEC.md`, `../README.md`.
  - Criteria: 11.

- [x] **Task 12: Dry read of the procedure, and the closing sweep** (S)
  - Description: A fresh agent that has seen none of this work reads only the spec's uptake procedure and walks its seven steps against 0.1.18, running the read-only commands, and lists every step it needed that is not written.
    Anything the build of Phase B did that the procedure does not say is added to that list.
    Each gap is written into the spec; then all 13 criteria are checked once more and the spec's and this plan's status lines are set.
    From Task 11's review: the README now links the upkeep straight to this spec, so the spec's "the heading stays, so the README's link still lands" gets its true reason: the card sidebar plan and decisions log name that section.
  - Acceptance:
    - The dry read ends with no unwritten step, or with each one now in the spec.
    - After the uptake, the spec's "what Herdr changed" command prints nothing but the folder listing.
    - A table in the checkpoint report gives the proof for each of the 13 criteria.
  - Verify: the agent's list; the diff command's output; the three-folder loop, both checks, `herdr-app status`, `find herdr-app -name '*.error'`.
  - Dependencies: Tasks 10a, 11.
  - Files: `docs/clone-upkeep/SPEC.md`, `docs/clone-upkeep/plan.md`.
  - Criteria: 12, 9, 13.

- [x] **Task 12a: The clones' own names, tested** (S)
  - Description: Found by Task 12's second dry read and taken at its approval on 2026-11-24.
    `clone.test.js` counts `mod: "agents-context"` exactly once, so a shipped overlay that opens its own mod, taken and renamed as step 3 says, turns it red for good.
    Nothing catches a shipped mod's name left in `spaces-cards` or in the layout: only the agents sort menu has a test.
    Tests first; the spec's wording follows.
  - Acceptance:
    - `agents-context/clone.test.js`: the sort menu's line (the one holding `sortMenu: true`; each such line, from the Checkpoint C review) opens `mod: "agents-context"`, and neither `mod: "agents"` nor `mods/agents/` occurs in the clone's `.js` files; no count of the clone's own name.
    - A test in `spaces-cards`: neither `mod: "spaces"` nor `mods/spaces/` occurs in its `.js` files.
    - `layouts/cards.json`: no block's `mod` is `spaces` or `agents`, beside the version check in `upstream/drift.test.js`, which already reads the three clones.
    - Today's tree passes each, so each is seen red in a scratch copy with the fault put in; there, a second `mod: "agents-context"` (a taken overlay, renamed) no longer turns anything red.
    - Spec: step 3's sentence on the count and step 7's "`clone.test.js` if its count moved" follow; the Tying test section, Project structure and Testing strategy name the new test; one decisions log entry.
  - Verify: the three-folder loop, with more passes than 179, 23 and 63 and no skip; both `herdr-app check` runs; `herdr-app status`; no `*.error` file.
  - Dependencies: Task 12.
  - Files: `mods/agents-context/clone.test.js`, a new test file in `mods/spaces-cards/`, `upstream/drift.test.js`, `docs/clone-upkeep/SPEC.md`.
  - Criteria: 1, 9.

### Checkpoint C: Documents and close

- [x] Test, review, ship as above.
- [x] Commit: `fix(herdr-app): close the upkeep's test gaps, point the card sidebar spec here`.
  One commit holds Task 10a's fixes and tests, Task 12a's tests, the spec's wording and log entries, and the documents of Tasks 11 and 12.
- [x] `git log origin/main..main` lists the three commits of this plan; nothing was pushed.
- [x] This plan fully checked.

## Success criteria map

| Criterion | Task | Shown at |
|---|---|---|
| 1. Four changes in `agents-context`, `clean` line as shipped, own sort menu | 5, 10a (tests), 12a (own names) | Checkpoints B and C |
| 2. The clone's own changes are the same lines against the 0.1.18 snapshot as against the 0.1.16 base | 8, 10a (a check that can fail), 12 (the check sorted, over every pair) | Checkpoints B and C |
| 3. `tellingTitle` gives the "after" column, old rows pass | 6 | Checkpoint B |
| 4. Tying test passes, and fails on each of the three regexes | 6 (passes), 9 (fails), 10a (tied to the snapshot) | Checkpoints B and C |
| 5. `/x/proj/.bare` is named `proj` | 7 | Checkpoint B |
| 6. `cloned_from.version` is `0.1.18` three times | 8, 10a (equal, tested) | Checkpoints B and C |
| 7. Five snapshots byte-for-byte, tracked | 3 (rules), 8 (`cmp`) | Checkpoint B |
| 8. Drift: no skip here, skip on a changed byte, silent when absent | 1, 2, 3a, 8, 9, 10a | Checkpoints A, B and C |
| 9. Loop, checks, status, no `*.error` | 3, then every checkpoint | A, B, C |
| 10. Three end to end states captured | 4 (before), 10 (after) | Checkpoint B |
| 11. Card sidebar spec done, pointer, questions 3 and 4 closed | 11 | Checkpoint C |
| 12. Dry read needs no unwritten step | 12 | Checkpoint C |
| 13. Commits on `main`, not pushed | every ship, 12 | A, B, C |

## Parallelization

- Task 4 needs no code and can run while Checkpoint A is in review.
- Tasks 9 and 10 both follow Task 8 and touch no tracked file; they can run side by side.
- Tasks 5 to 8 are one chain: the tying test reads the merged file, Tasks 6 and 7 share two files, and the snapshots must not land before the clones match them.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The merge writes `mod: "agents"` into the clone with no conflict | High | Base built as the spec says; Task 5 counts both names before and after, and merges to a scratch file first |
| The app updates itself during the work, so "shipped" is no longer 0.1.18 | Med | `herdr-app --version` checked at the start of Phase B and again before the `cp`; on a change, stop and report |
| A save disturbs the live window this work runs inside | Med | The app keeps the last good version; `herdr-app check` after every edit; mutations only in scratch copies; `cmd-shift-l` back to `main` |
| The app writes into or reacts to `upstream/` | Low | Task 3 looks after creating it; a restart is ask-first, so the cold start is seen at the next natural one and reported |
| An agent with a chosen emoji title cannot be staged by script | Med | Task 4 settles it first: a labelled `hc run` terminal that sets its title and reports a status; else a real agent in the scratch space with its title set from inside |
| The literal lookup in the tying test is fooled by a look-alike line | Med | Exactly one match required per line; Task 9 proves all three failures |
| `source` differs for an equal regex spelled another way | Low | `model.js` copies Herdr's spelling, escapes included; the tying test is red otherwise |
| Scratch repo, space or terminal left behind | Med | Task 10 ends with `herdr-app ls`, `hc ls` and `ls` as proof |

## Open questions

None that block the build.
Four readings this plan makes, approved with it on 2026-11-24:

1. The snapshots ship in the uptake commit, not with the scaffold, so Checkpoint A holds no snapshot.
2. A shipped layout file with no snapshot counts as changed, so Checkpoint A ships with three truthful skips.
3. `model.js` spells the `clean` regex as Herdr does, escapes included, not with the raw characters of the spec's code sample.
4. The card sidebar spec's Commands section keeps its two-folder test loop: that spec is done and the upkeep spec does not list the loop among its changes.

Readings 2 and 3 go beyond the spec's wording, so the task that builds each (Task 1, Task 6) adds it to the spec's decisions log.
