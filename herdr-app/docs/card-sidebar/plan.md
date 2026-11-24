# Implementation plan: Herdr card sidebar

Spec: [SPEC.md](SPEC.md), approved 2026-11-22.
Status: approved 2026-11-22, Checkpoint A shipped 2026-11-23, Checkpoint B shipped 2026-11-23, Checkpoint C shipped 2026-11-24, Phase 3 next.
Task list target: this file (the project keeps spec, plan and tasks together under `herdr-app/docs/card-sidebar/`, not in `tasks/`).

## Overview

Clone the shipped `main` layout and the `spaces` and `agents` mods, then change the clones in four vertical slices: scaffold, context readout, space cards, worktree affordances.
Each slice ends in a checkpoint that runs test, review, ship (committed, not pushed) before the next slice starts.

## Architecture decisions

- **Clones, not new mods from scratch.**
  The shipped `spaces` mod already solves git lookup, nesting, machine groups, drag reorder and scroll-to-active.
  The diff stays small and the patterns stay Herdr's.
- **Pure logic in its own module per mod** (`model.js`, `context.js`), with no `herdr` or `gpui-kit` import.
  Node can then unit test every decision; `main.js` only reads live data and draws.
- **Context comes from a file feed, not from parsing transcripts.**
  The status line already receives the exact number; one write step shares it.
  Both mods read the same feed through the same `context.js`, copied into each mod folder.
  Settled in Task 4: the app refuses an import that leaves the mod's own folder, so `spaces-cards` carries a copy, and a unit test keeps the two files identical.
- **The feed is untrusted input to the mods.**
  Any local process can write `~/.cache/herdr-context/`, so `context.js` accepts only a strictly shaped file and shows nothing otherwise.
- **No git writes in the new mods.**
  Creating, opening and removing checkouts stays in the shipped `worktree` dialog, opened with props.
- **End to end checks use a scratch repo** (`~/Development/scratch/herdr-e2e`), never the user's real repos.
  It and its spaces are removed at the final checkpoint.

## Dependency graph

```
T1 retire TUI config (independent)

T2 scaffold: clones + layout + tracking
 ├── T3 context feed (status line) ──> T4 readout in agents list
 │                                        └──> T6 (context % on card)
 ├── T5 card: repo, title, branch ──> T6 state slot, agent icons, context %
 │                                └──> T7 order: non-repo last
 └── T8 +N chip (needs T5 card) ──> T9 hover + for new worktree
```

Highest risk first: T2 (does the clone workflow and test layout work at all) and T3 (does the status line inherit `HC_TERMINAL_ID`).

## What every checkpoint runs

1. **Test:** the unit test loop from the spec's Commands section (one `node --test` run per mod folder, failing on a failed test and on a folder with 0 tests, because `node --test` exits 0 when it finds none), `herdr-app check` on both mods, `herdr-app status` with no errors, no `*.error` files, `herdr-app shot` reviewed at full size.
2. **Review:** five-axis code review of the checkpoint's diff by a fresh reviewer agent (`agent-skills:code-reviewer`), findings fixed or answered, then a simplification pass.
3. **Ship:** one commit on `main` per message listed at the checkpoint (Checkpoint A lists two, the rest one), no push, no co-author line.
4. **Report:** a short status with the screenshot path, then stop, ask for approval and give the exact command for the next step.
   Test, review, ship and the next build are each their own step with their own stop.

## Task list

### Phase 0: Foundation

- [x] **Task 1: Retire the TUI config** (XS)
  - Description: Ship the cleanup already in the working tree: `herdr/config.toml` removed, its `.gitignore` block and README line gone.
  - Acceptance:
    - `git status` shows only `.gitignore`, `README.md` and the deleted `herdr/config.toml` for this commit.
    - No tracked file mentions the TUI's `herdr/` folder.
  - Verify: `git grep -n -i 'herdr/' -- . ':!herdr-app' ':!.gitignore'` returns nothing; `command -v herdr` returns nothing.
  - Checkpoint A review: `herdr/` was added to the retired block of `.gitignore`, so a TUI config recreated by a later install is never tracked by accident; that one mention is expected.
  - Dependencies: none.
  - Files: `.gitignore`, `README.md`, `herdr/config.toml`.

- [x] **Task 2: Scaffold the clones and track them** (M)
  - Description: Create layout `cards` and mods `spaces-cards` and `agents-context` by clone, point the layout at the clones, set the 60 / 40 split, set `worktrees.directory`, and ignore everything under `herdr-app/` except the files the spec lists as tracked.
    Add one trivial `model.test.js` to settle whether test files can live in a mod folder.
  - Acceptance:
    - `layout.switch cards` shows a sidebar identical to shipped except for the 60 / 40 split (the sidebar edge and the spaces / agents boundary already drag in shipped, see the spec's decisions log).
    - `git status` lists only spec-tracked paths; no `*.d.ts`, `jsconfig.json`, state or socket files.
    - The app does not error or reload-loop with a `*.test.js` file present (else tests move to `docs/card-sidebar/tests/` and the spec is updated).
  - Verify: `herdr-app check` on both mods; `herdr-app status`; `node --test`; `herdr-app shot` of `cards` beside a shot of `main`; `git status --short`.
  - Dependencies: none.
  - Files: `layouts/cards.json`, `mods/spaces-cards/*`, `mods/agents-context/*`, `settings.json`, `../.gitignore`, `../README.md`.

### Checkpoint A: Foundation

- [x] Test, review, ship as above.
- [x] Commits: `chore(herdr): retire the TUI config`, then `feat(herdr-app): add the cards layout as tracked clones`.
- [x] `cmd-shift-l` still reaches an unchanged `main`.

### Phase 1: Context readout

- [x] **Task 3: Context feed from the status line** (S)
  - Description: Capture one real status line input to learn the exact `context_window` fields, then add the write step to `~/.claude/statusline.sh`: atomic write of `~/.cache/herdr-context/$HC_TERMINAL_ID.json`, only when the variable is set.
    The variable becomes part of a file path, so the step validates it first (letters, digits, `_` and `-` only) and writes nothing otherwise.
    The temp file has one fixed name per terminal inside the feed folder, so the rename stays on one filesystem and a killed run leaves nothing the next run does not replace; the folder is `0700` and the files `0600`.
    The feed carries no session id.
    Settles spec open question 1; if the variable is not inherited, switch the key to session id and record the fallback in the spec before continuing.
  - Acceptance:
    - Status line stdout is byte-identical before and after for the same input.
    - A live Claude Code session in a Herdr terminal produces `~/.cache/herdr-context/<its terminal id>.json` holding the percentage its status line shows.
    - With `HC_TERMINAL_ID` unset, or set to anything that is not a plain id (`../x`, `a/b`, empty), the script writes nothing and prints as before.
    - The feed folder is `0700`, feed files are `0600`, no temp file is left behind, and no feed file contains a session id.
  - Verify: `diff` of stdout from the old and new script on the captured input; `cat` of the feed file for this session's terminal; run once with the variable unset and once with a hostile value and confirm no new file; `stat` of the folder and a file.
  - Dependencies: none (parallel to Task 2).
  - Files: `~/.claude/statusline.sh`.

- [x] **Task 4: Context readout in the agents list** (M)
  - Description: Add `context.js` (parse a feed file, reject stale or malformed ones, choose the band) with tests written first, then show `NN%` on each Claude Code agent row with a tooltip for tokens and window size.
    A gentle timer rereads feeds only while agents exist.
    The mod treats the feed as untrusted: the terminal address is validated before it becomes a path, and a file is used only when it is a JSON object with a percentage from 0 to 100 and a write time between its terminal's start and now.
    Also settle how `spaces-cards` will reach `context.js` for Task 6: try a cross-mod import (`../agents-context/context.js`) under `herdr-app check` and in the live window, including whether saving `context.js` reloads the importing mod, then record the outcome in the spec's decisions log and project structure.
  - Acceptance:
    - This session's agent row shows a percentage within 2 points of its status line, updated within 10s.
    - 69, 70, 89 and 90 land in the dim, orange, orange and red bands in unit tests.
    - A missing, malformed or older-than-terminal feed shows no readout, in tests and in the window.
    - Out-of-range, non-numeric and future-dated feeds show no readout in unit tests.
    - The cross-mod import question has a recorded answer, and Task 6's file list matches it.
  - Verify: the unit test loop for `agents-context`; `herdr-app check herdr-app/mods/agents-context`; `herdr-app shot`, compared with the status line; temporary feed files at 50, 75 and 95 to capture each band, then removed.
  - Dependencies: Tasks 2, 3.
  - Files: `mods/agents-context/main.js`, `mods/agents-context/context.js`, `mods/agents-context/context.test.js`.
  - Checkpoint B review: the thin bar was dropped for `NN%` alone in a fixed-width slot, `band` and `BAND_COLORS` became one `bandColor`, and the feed step got a fixed temp name and removes the feed on unreadable input; see the spec's decisions log.

### Checkpoint B: Context readout

- [x] Test, review, ship as above.
- [x] Commit: `feat(herdr-app): show context usage in the agents list`.
- [x] Spec success criteria 7 and 8 demonstrated.

### Phase 2: Space cards

- [x] **Task 5: Three-line card with title and branch** (M)
  - Description: Replace the 30px row with the card: avatar and repo on line 1, title on line 2 (2 lines max), branch with middle ellipsis and the shipped ahead, behind and dirty marks on line 3, tooltip with full text, raised background when active, indented variant for nested worktree spaces.
    Title choice and `readableBranch` go in `model.js`, tests first.
    Click, right-click menu, drag reorder, machine headers and the narrow rail keep working as shipped.
  - Acceptance:
    - Both open spaces show a title that is not just the folder name.
    - A 40+ character branch shows both ends, and the tooltip shows all of it.
    - Title rules 1 to 4 each have a passing unit test, including the "telling" rejections (path, address, program name, `@`).
  - Verify: the unit test loop for `spaces-cards`; `herdr-app check herdr-app/mods/spaces-cards`; shots at 268px and 480px and in narrow rail, with a nested worktree space from the scratch repo.
  - Dependencies: Task 2.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.
  - Built 2026-11-23: the dirty mark is new, not shipped, and the title is cut after 2 lines without an ellipsis; see the spec's decisions log.
  - Carried to Checkpoint C: hover, click, right-click and drag on a card were not exercised, because nothing here can drive the pointer without a macOS Accessibility grant.
    The tooltip's text is unit tested; whether its three lines render as three lines needs one hover.
  - Checkpoint C review: title rule 1 no longer takes a tab the + menu named after its agent's program, and the dirty mark's `git status` can fail without blanking the place's repo and branch; see the spec's decisions log.

- [x] **Task 6: State slot, agent icons and context on the card** (M)
  - Description: Fill line 1's right side by the space's most urgent status (pill, spinner with elapsed, done dot, age) and line 3's right side with the space's agent program icons and its highest context percentage.
    Age and elapsed formatting and "highest context" go in pure modules, tests first.
    `context.js` is a byte-for-byte copy of the one in `agents-context` (Task 4 settled that mods cannot import across folders); a test in `model.test.js` fails when the two files differ.
    Spinner and any motion are native, with no redraw timer.
  - Acceptance:
    - Blocked, working, done and idle each show the spec's slot content in the live window.
    - Age formats as `just now`, `5m`, `2h`, `3d` at the boundaries in unit tests.
    - The card's context percentage equals the highest among its agents' rows in the list below.
    - Changing either copy of `context.js` alone fails the unit tests.
  - Verify: unit tests; `herdr-app check`; one shot per status, produced with a real agent in the scratch repo space.
  - Dependencies: Tasks 4, 5.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`, `mods/spaces-cards/context.js`.
  - Built 2026-11-23: the slot's times come from Herdr's `working_since` and `changed_at`, so an idle card shows no age until something changes after an app start; each agent program is drawn once; the context reading is described in the card's own tooltip; see the spec's decisions log.
  - Carried to Checkpoint C: the tooltip's context line is unit tested but was not hovered, and the narrow rail and 480px width were not shot again after this task.

- [x] **Task 7: Non-repo spaces last, order kept real** (S)
  - Description: Extend the shipped ordering so spaces outside any repo follow all repo groups, and keep the real space order equal to the visual one through the shipped `space.move` path, so `ctrl-1..9` matches the screen.
    The ordering function is pure and tested first; it must be stable so it never issues moves when nothing changed.
  - Acceptance:
    - A space in `~` is drawn after every repo group.
    - `ctrl-N` selects the card at visual position N for every N on screen.
    - With order already correct, no `space.move` runs (asserted in a unit test on the planned moves).
  - Verify: unit tests; `herdr-app ls` order compared with a shot; `herdr-app do space.select --index N` checked against the card highlighted.
  - Dependencies: Task 5.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.
  - Built 2026-11-23: "last" holds per machine, a space is moved last only on git's own answer and only once git has answered for every space of its machine, and a drag across the repo boundary goes back; see the spec's decisions log.
  - Carried to Checkpoint C: a pointer drag and a real `ctrl-N` press were not exercised (the moves and `space.select --index` were run by command), remote machines are covered by unit tests only, and the space outside any repo for end to end state 7 was closed after the check, so it is made again for the capture.
  - Checkpoint C review: only a place not looked at yet holds the rule back (`standing` in `model.js`), a place stays unanswered until git's answer lands, and nested rows carry `nested: true`; see the spec's decisions log.

### Checkpoint C: Space cards

- [x] Test, review, ship as above.
- [x] Commit: `feat(herdr-app): turn space rows into cards`.
- [x] Spec success criteria 1 to 4 and 9 demonstrated, except the hover half of criterion 3 (still carried, below); end to end states 1, 2, 3, 6 and 7 captured.
  - Test 2026-11-23: unit tests 61 and 19 passing, both mods pass `herdr-app check`, `herdr-app status` lists no errors, no `*.error` file.
    The avatar letter fix (`avatarLetter`) was made test-first during this step; see the spec's decisions log.
  - Still carried: the card hover tooltip (the hover half of criterion 3), a pointer drag and a real `ctrl-N` press.
    Nothing here can drive the pointer or the keyboard without a macOS Accessibility grant, so these three are checked by hand.
    `space.select --index N`, the command `ctrl-N` is bound to, lit the card at place N for N from 1 to 5.
  - Review 2026-11-24: a fresh `agent-skills:code-reviewer` asked for changes (2 required, 2 optional, nits); all were fixed or answered, see the "Checkpoint C review" entries in the spec's decisions log.
    The two required fixes were reproduced in the live window before and after: the + menu's "Claude Code" title, and a space in a bare repo moved during a re-ask.
    After the simplification pass: unit tests 75 and 19 passing, both mods pass `herdr-app check`, `herdr-app status` lists no errors, no `*.error` file.
    Approved as recommended: `standing` narrows the Task 7 rule, and `plannedMoves` stays the shipped algorithm.
    Not shown live: the `git status` failure path (it needs a 30s timeout) and anything on a remote machine.
  - Ship 2026-11-24: fresh code review, security audit and test coverage passes found nothing critical; unit tests 75 and 19 passing, both mods pass `herdr-app check`, `herdr-app status` lists no errors, no `*.error` file.
    Open from the ship passes, none fixed in this commit:
    a space known to be outside a repo counts as inside again when a later look at it fails, so among two or more such spaces it can move above another and stay there (`standing` cannot tell "never answered no" from "answered no, last look failed");
    the dirty mark's `git status` runs the clean filters a repo's own config names, which the ref-only reads never did;
    that same read has the default 30s limit and holds back the redraw of every place in its pass;
    the context read every 5s has no guard against an earlier read still running;
    a + menu tab still titles its card "Claude Code" once its agent is gone or before it first reports.
  - Open: in the narrow rail the blocked and done dot overlaps the space's number.
    The rail code is identical to shipped and the spec keeps the rail as shipped, so it is left alone unless decided otherwise.

### Phase 3: Worktrees

- [ ] **Task 8: `+N` chip for checkouts not open** (M)
  - Description: Per repo, read `git worktree list --porcelain` inside the existing refresh path (same cache, same watch, same concurrency cap), count checkouts that are not the live folder of an open space on that machine, and show `+N` on the repo card.
    Clicking it opens the shipped `worktree` dialog with `action: "open"`.
    Porcelain parsing and the count are pure, tests first.
  - Acceptance:
    - With one scratch checkout on disk and closed, the repo card shows `+1`; opening it as a space removes the chip.
    - Choosing the checkout in the dialog opens it as a nested space.
    - Bare, detached and prunable entries in porcelain output are handled in unit tests.
  - Verify: unit tests; `herdr-app check`; shot with the chip and shot of the picker.
  - Dependencies: Task 5.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.

- [ ] **Task 9: Hover `+` creates a worktree with an agent** (S)
  - Description: Show a `+` button on a repo card on hover that opens the shipped `worktree` dialog with `{ space, action: "new", argv }`, where `argv` is Claude Code's `run` from `knownAgents()`.
    The button stops the press so it does not start a card drag or select.
  - Acceptance:
    - From the scratch repo card, `+` and a branch name create `~/Development/worktrees/herdr-e2e/<branch>`, open it as a nested space and start `claude` there.
      The shipped dialog turns slashes in the branch into dashes for the folder, so branch `feat/x` lands in `herdr-e2e/feat-x`; test with a branch that has a slash.
    - Clicking `+` never selects or drags the card.
  - Verify: `git -C ~/Development/scratch/herdr-e2e worktree list`; `herdr-app ls` shows the new space with a `claude-code` terminal; shot of the hover state and of the result.
  - Dependencies: Task 8.
  - Files: `mods/spaces-cards/main.js`.

### Checkpoint D: Complete

- [ ] Test, review, ship as above.
- [ ] Commit: `feat(herdr-app): surface unopened worktrees and one-click creation`.
- [ ] All 12 spec success criteria checked off with evidence; all 7 end to end states captured and inspected for clipping, alignment and theme-foreign colors.
- [ ] Scratch repo, its checkouts, its spaces and temporary feed files removed; `herdr-app ls` and `git status` are clean of test leftovers.
- [ ] README "Layout" section describes `herdr-app/` and how to re-diff the clones against a newer shipped version (`cloned_from` in each clone).
- [ ] Spec status set to done; this plan fully checked.

## Parallelization

- Task 3 (status line) is independent of Task 2 and can run alongside it.
- Phase 1 touches only `agents-context`, Phase 2 only `spaces-cards`; they could run in parallel, but Task 6 needs Task 4's `context.js`, so the plan runs them in order.
- Each checkpoint's review runs in a fresh reviewer agent while the next task's tests are written.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Status line process does not inherit `HC_TERMINAL_ID` | Med | Task 3 runs early; fallback keyed by session id is specified |
| A broken save disturbs the live window this work runs inside | Med | App keeps the last good version; `herdr-app check` before relying on a save; `cmd-shift-l` cycles back to `main`; `ctrl-alt-shift-escape` as last resort |
| `tooltip` is string-only; multi-line text may not render | Low | Fall back to `HoverCard`, which the type file provides |
| No 2-line clamp builder in this gpui-kit build | Low | Check `gpui-kit.d.ts` first; else fixed 2-line height with hidden overflow; no ellipsis could be placed, see the spec's decisions log |
| Reordering fights the user's drag or loops on `space.move` | Med | Pure, stable ordering with a "no moves when already ordered" test; reuse the shipped move path unchanged |
| Extra git call per repo slows refresh | Low | Reuse the shipped cache and watch; the lookup cap went from 6 to 5 places and the extra call is one per place, see the spec's decisions log |
| Shipped mods change in a later Herdr release; clones do not | Low | `cloned_from` records the version; README notes how to re-diff |
| Test files in a mod folder trigger reloads | Low | Settled in Task 2; fallback location specified |
| End to end checks leave spaces, checkouts or agents behind | Med | Scratch repo only; cleanup is a checkpoint D item with `herdr-app ls` and `git worktree list` as proof |

## Open questions

None that block the build.
The spec's test-location question was settled in Task 2 and its `HC_TERMINAL_ID` question in Task 3.
