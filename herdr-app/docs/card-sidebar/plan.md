# Implementation plan: Herdr card sidebar

Spec: [SPEC.md](SPEC.md), approved 2026-11-22.
Status: approved 2026-11-22, Checkpoint A shipped 2026-11-23, Phase 1 next.
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
  Both mods read the same feed through the same `context.js`, copied into each mod folder because mods cannot import across folders safely after `mod.clone` rewrites paths.
  If a cross-mod import turns out to work, keep one copy in `agents-context` and import it.
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

1. **Test:** `node --test herdr-app/mods/spaces-cards/ herdr-app/mods/agents-context/`, `herdr-app check` on both mods, `herdr-app status` with no errors, no `*.error` files, `herdr-app shot` reviewed at full size.
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
  - Verify: `git grep -n -i 'herdr/' -- . ':!herdr-app'` returns nothing; `command -v herdr` returns nothing.
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

- [ ] **Task 3: Context feed from the status line** (S)
  - Description: Capture one real status line input to learn the exact `context_window` fields, then add the write step to `~/.claude/statusline.sh`: atomic write of `~/.cache/herdr-context/$HC_TERMINAL_ID.json`, only when the variable is set.
    Settles spec open question 1; if the variable is not inherited, switch the key to session id and record the fallback in the spec before continuing.
  - Acceptance:
    - Status line stdout is byte-identical before and after for the same input.
    - A live Claude Code session in a Herdr terminal produces `~/.cache/herdr-context/<its terminal id>.json` holding the percentage its status line shows.
    - With `HC_TERMINAL_ID` unset the script writes nothing and prints as before.
  - Verify: `diff` of stdout from the old and new script on the captured input; `cat` of the feed file for this session's terminal; run once with the variable unset and confirm no new file.
  - Dependencies: none (parallel to Task 2).
  - Files: `~/.claude/statusline.sh`.

- [ ] **Task 4: Context readout in the agents list** (M)
  - Description: Add `context.js` (parse a feed file, reject stale or malformed ones, choose the band) with tests written first, then show the thin bar and `NN%` on each Claude Code agent row with a tooltip for tokens and window size.
    A gentle timer rereads feeds only while agents exist.
  - Acceptance:
    - This session's agent row shows a percentage within 2 points of its status line, updated within 10s.
    - 69, 70, 89 and 90 land in the dim, orange, orange and red bands in unit tests.
    - A missing, malformed or older-than-terminal feed shows no readout, in tests and in the window.
  - Verify: `node --test herdr-app/mods/agents-context/`; `herdr-app check herdr-app/mods/agents-context`; `herdr-app shot`, compared with the status line; temporary feed files at 50, 75 and 95 to capture each band, then removed.
  - Dependencies: Tasks 2, 3.
  - Files: `mods/agents-context/main.js`, `mods/agents-context/context.js`, `mods/agents-context/context.test.js`.

### Checkpoint B: Context readout

- [ ] Test, review, ship as above.
- [ ] Commit: `feat(herdr-app): show context usage in the agents list`.
- [ ] Spec success criteria 7 and 8 demonstrated.

### Phase 2: Space cards

- [ ] **Task 5: Three-line card with title and branch** (M)
  - Description: Replace the 30px row with the card: avatar and repo on line 1, title on line 2 (2 lines max), branch with middle ellipsis and the shipped ahead, behind and dirty marks on line 3, tooltip with full text, raised background when active, indented variant for nested worktree spaces.
    Title choice and `readableBranch` go in `model.js`, tests first.
    Click, right-click menu, drag reorder, machine headers and the narrow rail keep working as shipped.
  - Acceptance:
    - Both open spaces show a title that is not just the folder name.
    - A 40+ character branch shows both ends, and the tooltip shows all of it.
    - Title rules 1 to 4 each have a passing unit test, including the "telling" rejections (path, address, program name, `@`).
  - Verify: `node --test herdr-app/mods/spaces-cards/`; `herdr-app check herdr-app/mods/spaces-cards`; shots at 268px and 480px and in narrow rail, with a nested worktree space from the scratch repo.
  - Dependencies: Task 2.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.

- [ ] **Task 6: State slot, agent icons and context on the card** (M)
  - Description: Fill line 1's right side by the space's most urgent status (pill, spinner with elapsed, done dot, age) and line 3's right side with the space's agent program icons and its highest context percentage.
    Age and elapsed formatting and "highest context" go in pure modules, tests first.
    Spinner and any motion are native, with no redraw timer.
  - Acceptance:
    - Blocked, working, done and idle each show the spec's slot content in the live window.
    - Age formats as `just now`, `5m`, `2h`, `3d` at the boundaries in unit tests.
    - The card's context percentage equals the highest among its agents' rows in the list below.
  - Verify: unit tests; `herdr-app check`; one shot per status, produced with a real agent in the scratch repo space.
  - Dependencies: Tasks 4, 5.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`, `mods/spaces-cards/context.js`.

- [ ] **Task 7: Non-repo spaces last, order kept real** (S)
  - Description: Extend the shipped ordering so spaces outside any repo follow all repo groups, and keep the real space order equal to the visual one through the shipped `space.move` path, so `ctrl-1..9` matches the screen.
    The ordering function is pure and tested first; it must be stable so it never issues moves when nothing changed.
  - Acceptance:
    - A space in `~` is drawn after every repo group.
    - `ctrl-N` selects the card at visual position N for every N on screen.
    - With order already correct, no `space.move` runs (asserted in a unit test on the planned moves).
  - Verify: unit tests; `herdr-app ls` order compared with a shot; `herdr-app do space.select --index N` checked against the card highlighted.
  - Dependencies: Task 5.
  - Files: `mods/spaces-cards/main.js`, `mods/spaces-cards/model.js`, `mods/spaces-cards/model.test.js`.

### Checkpoint C: Space cards

- [ ] Test, review, ship as above.
- [ ] Commit: `feat(herdr-app): turn space rows into cards`.
- [ ] Spec success criteria 1 to 4 and 9 demonstrated; end to end states 1, 2, 3, 6 and 7 captured.

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
| No 2-line clamp builder in this gpui-kit build | Low | Check `gpui-kit.d.ts` first; else fixed 2-line height with hidden overflow and ellipsis on the second line |
| Reordering fights the user's drag or loops on `space.move` | Med | Pure, stable ordering with a "no moves when already ordered" test; reuse the shipped move path unchanged |
| Extra git call per repo slows refresh | Low | Reuse the shipped cache, watch and 6-lookup cap; one extra call per repo, not per space |
| Shipped mods change in a later Herdr release; clones do not | Low | `cloned_from` records the version; README notes how to re-diff |
| Test files in a mod folder trigger reloads | Low | Settled in Task 2; fallback location specified |
| End to end checks leave spaces, checkouts or agents behind | Med | Scratch repo only; cleanup is a checkpoint D item with `herdr-app ls` and `git worktree list` as proof |

## Open questions

None that block the build.
The spec's test-location question was settled in Task 2; its one remaining open question is settled inside Task 3.
