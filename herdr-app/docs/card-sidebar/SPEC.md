# Spec: Herdr card sidebar

Status: approved 2026-11-22.
Plan and task list: [plan.md](plan.md).
Source: grill session of 2026-11-22, decisions Q1 to Q21.

## Objective

The shipped Herdr sidebar shows each space as one 30px row holding only a folder name and a short git tail.
Rows are too small, carry too little detail, and cut long worktree names.
Agent context usage is not visible anywhere in the window.

Build a personal sidebar for one user on one Mac that keeps what already works and fixes those gaps:

- Keep the shipped model: spaces on top, agents at the bottom, only open spaces listed, worktree spaces nested under their repo space.
- Replace each space row with a 3-line card that shows repo, state, a real title, branch and git state.
- Give every card a title automatically, without the mod ever making a model call.
- Make checkouts that exist on disk but are not open easy to see and one click to open.
- Make starting a new worktree with an agent one click from the repo card.
- Show how full each agent's context window is.

### User stories

1. As the user, I glance at the sidebar and know what each space is working on, not just which folder it is in.
2. As the user, I can read a long branch name's start and end, and see all of it on hover.
3. As the user, I can see that a repo has other checkouts on disk and open one without hunting through a menu.
4. As the user, I can start a new worktree with an agent from the repo card.
5. As the user, I can see which agent is close to filling its context before it compacts.
6. As the user, I can switch back to the shipped layout at any time with `cmd-shift-l`, which cycles through the layouts.

### Out of scope

- Inbox workflow: settle, snooze, search, shelves, pins beyond what the shipped agents list has.
- Showing unopened checkouts as rows in the tree.
- Tabs or agents as tree levels under a space.
- Cost, rate limit or lifetime token totals.
- Agents other than Claude Code for the context readout (none are installed).
- Remote machines for the context readout (the feed file is local).
- Any new keybinding.
- Changes to the narrow rail (sidebar under 160px), which stays as shipped.

## Assumptions

1. Herdr app 0.1.16 and herdr-core 0.1.21, macOS, Apple Silicon.
2. Shipped layouts and mods are read-only and replaced on every app start, so all work lives in clones.
3. Claude Code sets the terminal title itself, and that title is readable as `agents()[i].title`.
4. Every Herdr terminal exports `HC_TERMINAL_ID` (verified: `t4` in the session that wrote this spec).
5. The status line process started by Claude Code inherits that variable (verified 2026-11-23 in plan task 3).
6. `~/.claude/statusline.sh` is the user's own file and may be extended by one write step.
7. Node 26 is available through mise and can run the unit tests.

## Tech stack

- Herdr mods: JavaScript on gpui-kit (GPUI elements, no DOM), API in `herdr-app/herdr.d.ts` and `herdr-app/gpui-kit.d.ts`.
- Layout: `herdr-app/layouts/cards.json`.
- Git facts: `exec("git", ...)` from the mod, as the shipped `spaces` mod already does.
- Context feed: bash + `jq` in `~/.claude/statusline.sh`.
- Unit tests: `node --test` (Node 26, built in, no dependencies).

## Commands

All paths are relative to `~/.config`.

```sh
# Create the clones (once)
herdr-app do layout.clone '{"name":"main","as":"cards"}'
herdr-app do mod.clone '{"name":"spaces","as":"spaces-cards"}'
herdr-app do mod.clone '{"name":"agents","as":"agents-context"}'

# Unit tests for pure logic: one run per mod folder.
# `node --test` exits 0 when it finds no tests, so a folder with 0 tests fails here.
(for mod in spaces-cards agents-context; do
  out=$(node --test --test-reporter=tap "herdr-app/mods/$mod/") && ! grep -qx '# tests 0' <<<"$out" \
    || { echo "$out"; echo "FAIL $mod"; exit 1; }
  echo "$mod: $(grep -x '# pass [0-9]*' <<<"$out")"
done)

# Load check, after every edit
herdr-app check herdr-app/mods/spaces-cards
herdr-app check herdr-app/mods/agents-context

# Errors from files and mods (must list none)
herdr-app status
find herdr-app -name '*.error'

# See the window
herdr-app do layout.switch '{"name":"cards"}'
herdr-app shot /tmp/herdr-cards.png

# Context feed, without a live agent
echo '{"context_window":{"used_percentage":42}}' | HC_TERMINAL_ID=spec-test bash ~/.claude/statusline.sh
cat ~/.cache/herdr-context/spec-test.json
rm ~/.cache/herdr-context/spec-test.json
```

## Project structure

```
herdr-app/
  docs/card-sidebar/SPEC.md        this file
  docs/card-sidebar/plan.md        plan and task list
  layouts/cards.json               clone of main, points at the two mods below
  mods/spaces-cards/
    main.js                        the view: init, refresh, render
    model.js                       pure logic, no herdr or gpui imports
    model.test.js                  node --test
    context.js                     byte-for-byte copy of agents-context/context.js (plan task 6): mods cannot import across folders
    mod.json
  mods/agents-context/
    main.js                        shipped agents list plus the context readout
    context.js                     pure logic: parse feed file, pick color band
    context.test.js
    mod.json
  settings.json                    adds worktrees.directory
~/.claude/statusline.sh            one added write step (outside this repo)
~/.cache/herdr-context/<id>.json   feed files, one per terminal (not tracked)
```

Tracked in the `~/.config` repo: `herdr-app/docs/`, `herdr-app/layouts/cards.json`, `herdr-app/mods/spaces-cards/`, `herdr-app/mods/agents-context/`, `herdr-app/settings.json`.
Everything else under `herdr-app/` is ignored: app-written state, shipped mods and layouts, `*.d.ts`, `jsconfig.json`, sockets.

## Behavior

### Layout `cards`

- Clone of `main` with `spaces` replaced by `spaces-cards` and `agents` by `agents-context`.
- Sidebar width is drag-resizable as in shipped, same 44 to 480px limits, default 268px.
  The sidebar's own `"resizable": false` stays: it locks the brand and footer heights, not the width.
- Spaces block and agents block share the sidebar 60 / 40, with a draggable divider.
- Brand header, footer, tab bar, panes, right panels and status bar are unchanged.

### Space card (`spaces-cards`)

One card per open space, about 62px tall, three lines.

| Line | Left | Right |
|---|---|---|
| 1 | Avatar letter (shipped colors) + repo name | State slot |
| 2 | Title, up to 2 lines, the rest cut off | |
| 3 | Branch, ahead, behind, dirty mark | Agent icons, context % |

State slot, by the space's most urgent agent status:

| Status | Shows |
|---|---|
| blocked | "Needs you" pill |
| working | spinner + elapsed since `working_since` (`3m`) |
| done | "Done" with a dot |
| idle, or no agent | age since last change (`just now`, `5m`, `2h`, `3d`) |

Title, first match wins:

1. The name the user typed (space or tab `named`).
   A tab named after an agent in it does not count: the + menu names a new agent's tab after its program.
2. The terminal title of the most recently active agent in the space, when it is "telling" by the shipped rule (not a path, address, program name, or anything containing `@`).
3. The branch name made readable: prefix up to the last `/` dropped, dashes and underscores to spaces, first letter upper case (`feat/analyze-in-daemon` becomes "Analyze in daemon").
4. The folder name.

The mod never reads prompts or transcripts for a title.

Other rules:

- Branch uses middle ellipsis so both ends stay readable.
- `main` and `master` are shown, unlike shipped, because line 3 would otherwise be empty.
- Hovering a card shows a tooltip with the full title, full branch and folder.
- A nested worktree space is the same card, indented, with the branch glyph in place of the avatar.
- The active space has the raised background, as in the reference image.
- Click selects the space, right-click opens the shipped space menu, drag reorders within a machine, as shipped.
- Machine group headers, login guidance and loading rows behave as shipped.
- Non-repo spaces are grouped after all repo spaces, and the mod keeps the real space order equal to the visual order with `space.move`, so `ctrl-1..9` matches what is on screen.

### Worktrees

- `+N` chip on a repo card when N checkouts from `git worktree list --porcelain` are not the live folder of any open space on that machine.
- Clicking the chip opens the shipped `worktree` dialog with `action: "open"` for that repo.
- A `+` button appears on a repo card on hover and opens the shipped `worktree` dialog with `{ space, action: "new", argv }`, which creates the checkout, opens it as a space and starts `claude` in its first tab.
- `settings.json` gets `"worktrees": { "directory": "~/Development/worktrees" }`, so checkouts land in `~/Development/worktrees/<repo>/<branch>`.
  The shipped dialog turns slashes in the branch into dashes for the folder name: branch `feat/x` lands in `<repo>/feat-x`.
- No git write commands are added to the new mods; creation and removal stay in the shipped `worktree` mod.

### Context readout

Feed:

- `~/.claude/statusline.sh` writes `~/.cache/herdr-context/$HC_TERMINAL_ID.json` on every run, only when `HC_TERMINAL_ID` is set and is a plain id (1 to 64 letters, digits, `_`, `-`), because it becomes part of a file path.
- Content: `used_percentage`, plus token count, window size and model when Claude Code provides them, and a write timestamp.
  No session id: nothing reads it, and it would only add an identifier to a file other processes can read.
- The write is atomic (a temp file inside the feed folder, then rename) and never changes what the status line prints.
  The temp file has one fixed name per terminal, so a run killed halfway leaves nothing that the next run does not replace.
- Input the write step cannot read removes the terminal's feed file, so a change in Claude Code's status line input shows no readout rather than the last good number.
- The script creates the folder as `0700` and the files as `0600`.
- The mods treat the feed as untrusted: the terminal address is validated before it becomes a path, and a file counts only when it is a JSON object whose percentage is a number from 0 to 100 and whose write time lies between its terminal's start and now.
  Anything else shows no readout.

Display:

- `agents-context` shows `NN%` on each Claude Code agent row, right-aligned in a fixed-width slot so the percentages and the times next to them form straight columns.
- `spaces-cards` shows the highest percentage among the space's agents on line 3.
- Bands use the thresholds and warning colors of `~/.claude/statusline.sh` (`sev_color`): 70 to 89 orange `#ffaf00`, 90 and above red `#ff5f5f`.
  Under 70 the readout is the theme's dim where the status line is blue, so a list of readouts stays quiet until one needs attention.
  These two fixed colors are the status line's colorblind-safe ramp and are the only non-theme colors this work adds to the mods.
- Tooltip on the readout shows tokens used and window size when known.
  On a card the same text is the last line of the card's own tooltip.
- An agent with no feed file, or a file older than its terminal (`created_ms` in `terminals()`), shows no readout rather than a stale number.
- The readout is on agent rows that have a pane; sub-agent rows under a parent and the narrow rail stay as shipped.
- Refresh is by a gentle timer (about every 5s) only while agents exist, not by a per-frame redraw.

Everything else in `agents-context` is identical to the shipped `agents` mod.

## Code style

Follow the shipped mods: chained snake_case builders, `theme()` colors only, one `View` class per mod.
Pure decisions live in a module with no `herdr` or `gpui-kit` import, so Node can test them.

```js
// model.js - pure, testable
export function readableBranch(branch) {
  const leaf = branch.slice(branch.lastIndexOf("/") + 1).replace(/[-_]+/g, " ").trim();
  return leaf ? leaf[0].toUpperCase() + leaf.slice(1) : branch;
}

// main.js - view only
const card = (s, t) =>
  v_flex().id(`card-${s.id}`).px(10).py(7).gap(2).rounded(8)
    .when(s.active, (el) => el.bg(t.raised))
    .hover((el) => el.bg(t.hover))
    .on_click(() => run("space.select", { id: s.id }))
    .child(headline(s, t))
    .child(div().text_size(13).font_semibold().text_color(t.foreground).child(titleOf(s)))
    .child(gitLine(s, t));
```

Conventions:

- Never keep a `cx` for later use; each callback uses its own.
- Animate natively (`spin`, `frames`, `transition`), never with a redraw timer.
- Timers only for data, and only as often as the data changes.
- No comments that restate the code.
- Plain dash, never an em dash, in code, docs and commit messages.

## Testing strategy

| Level | What | How |
|---|---|---|
| Unit | Title priority, readable branch, age and elapsed formatting, unopened checkout count from porcelain output, visual order with non-repo spaces last, context feed parsing and color band | `node --test`, files next to the code |
| Load | Each mod loads and renders once | `herdr-app check <mod>` after every edit |
| Feed | Status line writes the file and prints the same line as before | pipe sample JSON through the script, compare stdout before and after, read the file |
| End to end | The real window | `herdr-app shot`, inspected at full size for spacing, alignment and clipping |

End to end states that must be captured and reviewed:

1. Repo space with a nested worktree space.
2. Branch name of 40+ characters and a title that needs 2 lines.
3. Each status: blocked, working, done, idle.
4. `+N` chip visible, and the picker it opens.
5. Context readout in each color band.
6. Sidebar at 268px, at 480px, and in narrow rail.
7. A space outside any repo.

A real worktree is created through the `+` button for these captures and removed afterwards through the shipped Remove worktree action.

## Boundaries

Always:

- Run `herdr-app check` and the unit tests after every edit, and confirm no `*.error` file exists.
- Work only in the clones, `settings.json`, the docs folder, the `herdr-app` entries in the repo's `.gitignore` and `README.md`, and the one status line step.
- Prove each slice in the live window with a screenshot before calling it done.
- Fix lint, test failures and visual defects seen along the way, even when not caused by this work.

Ask first:

- Any change to `keys.json`.
- Any change to `~/.claude/statusline.sh` beyond the single write step.
- Cloning the shipped `worktree` or `menu` mods.
- Installing any third-party mod or layout.
- Pushing, or removing any worktree or branch not created by the tests.

Never:

- Edit shipped mods, shipped layouts, `AGENTS.md` or the `.d.ts` files.
- Make a model or network call from a mod.
- Read `~/.claude/sessions/*.key` or print secrets.
- Add a keybinding or a command the user has to remember.
- Commit app-written state.

## Success criteria

1. `herdr-app do layout.switch '{"name":"cards"}'` shows the new sidebar, and `cmd-shift-l` cycles back to an unchanged shipped `main`.
2. Both spaces open today show a 3-line card with a title that is not just the folder name.
3. A 40+ character branch shows its first and last parts, and the full name on hover.
4. A worktree space is drawn indented under its repo space.
5. With one checkout on disk and not open, the repo card shows `+1`, and choosing it opens that checkout as a space.
6. The `+` button creates `~/Development/worktrees/<repo>/<branch>`, opens it as a space and starts `claude` there.
7. A running Claude Code agent shows a context percentage within 2 points of its own status line, updated within 10s of a change.
8. The status line prints byte-identical output before and after the added write step.
9. `ctrl-1..9` selects the space at that visual position.
10. Unit tests pass, both mods pass `herdr-app check`, `herdr-app status` reports no errors, no `*.error` file exists.
11. All seven end to end states are captured and show no clipped text, misaligned rows or theme-foreign colors.
12. Commits on `main`, not pushed, as listed per checkpoint in [plan.md](plan.md), starting with `chore(herdr): retire the TUI config`.

## Decisions log

- 2026-11-22: First-prompt title fallback dropped.
  It needed transcript parsing through Claude Code internals to cover the few seconds before Claude Code writes its own title; the branch-based title covers that gap.
- 2026-11-22: Context color bands reuse the status line's thresholds and colors instead of 60 / 80 with yellow.
- 2026-11-22: One commit per checkpoint instead of a single feature commit, to match the build, test, review, ship loop.
  Checkpoint A carries a second commit, because the TUI cleanup is independent of the scaffold.
- 2026-11-22 (Task 2): The `cards` layout changes only the two mod names and the 60 / 40 weights.
  `resizable` on a row or column locks the boundaries between its own children, so the shipped root row already lets the sidebar edge drag and `sidebar-lists` already lets the spaces / agents boundary drag.
  Removing `"resizable": false` from `sidebar` would have made the brand and footer heights draggable.
  Evidence: the layout docs in `AGENTS.md`, the shipped mods' own comment ("dragging its edge narrows it too"), and `win98.json`, which sets the flag on the row whose children it locks.
- 2026-11-22 (Task 2): Unit test files stay next to the code in the mod folders.
  The app loads only what `main.js` imports, reported no error and did not rewrite its own files in the folder after `model.js` and `model.test.js` were saved.
  `node --test` accepts the two mod folders as arguments.
- 2026-11-22 (Task 2): The layout switch key on this Mac is `cmd-shift-l` (`keys.json`), not `ctrl-shift-l`; spec and plan corrected.
  It is bound to `layout.switch` with no name, so it cycles through every layout rather than toggling between two; `herdr-app do layout.switch '{"name":"main"}'` goes straight there.
- 2026-11-22 (Checkpoint A review): `settings.json` is tracked even though the app also writes it.
  It is the only place `worktrees.directory` can live, and `AGENTS.md` treats the file as the person's settings rather than app state.
  The zoom keys and the Settings screen save to the same file, so it can show diffs that were not made by hand; review them like any other change.
- 2026-11-23 (Checkpoint A review): `.gitignore` tracks only `*.md` under `herdr-app/docs/` and only `*.js`, `*.svg` and `mod.json` inside the two mod folders, so screenshots, scratch files and app-written files cannot be committed by accident.
  `herdr/` joined the retired block, so a TUI config recreated by a later install stays untracked.
- 2026-11-23 (Checkpoint A review): Unit tests run once per mod folder and a folder with 0 tests fails.
  `node --test` exits 0 when it finds no test file, which let `agents-context` pass with nothing tested.
- 2026-11-23 (Checkpoint A review): The feed drops the session id and is treated as untrusted input by the mods; see Context readout.
- 2026-11-23 (Task 3): The status line inherits `HC_TERMINAL_ID`, so the feed is keyed by terminal id and the session id fallback is not needed.
  A captured input showed `context_window` holding `used_percentage`, `context_window_size` and `current_usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`).
  The feed's token count is the sum of the three input fields, which is what the percentage is computed from; output tokens are left out.
  The feed is `{ used_percentage, tokens, window, model, written_at }`, with `written_at` in epoch milliseconds.
- 2026-11-23 (Task 4): Mods cannot import across mod folders.
  `import ... from "../agents-context/context.js"` in `spaces-cards` fails both `herdr-app check` and the live reload with "resolves outside the application directory".
  `spaces-cards` therefore gets its own copy of `context.js` in plan task 6, kept identical by a unit test.
- 2026-11-23 (Task 4): Synthetic feeds at 75 and 95 and a stale, a malformed and an out-of-range feed were captured in the window.
  A synthetic 50 could not be held long enough: the live status line rewrites the feed within seconds, which is the feed working as intended.
  The dim band is shown by the real readings instead.
- 2026-11-23 (Checkpoint B review): The agent row drops the thin bar and shows `NN%` alone.
  At 268px the bar cost about 27px of a title budget of about 112px, and at 22px wide it resolved only about 4.5 points per pixel, which the number and its color already say.
  The percentage and the time each get a fixed-width slot, and the idle and done marks are as wide as the spinner, so both columns are straight down the list and do not move on hover.
  A space name longer than about 17 characters still takes the whole title budget at 268px in the priority view, leaving no room for the detail; the name wins on purpose.
- 2026-11-23 (Checkpoint B review): Under 70 the readout stays dim, not the status line's blue.
  In the sidebar color means an agent needs attention, blue is already the window's accent, and dim to orange is a jump in salience where blue to orange is only a change of hue.
  The earlier wording, "one number never has two colors", was wrong for this band and is gone.
- 2026-11-23 (Checkpoint B review): The feed's temp file has a fixed name per terminal instead of a `mktemp` name, and unreadable input removes the feed.
  Killing the script between `mktemp` and rename left a temp file behind in about a quarter of forced runs, and nothing swept them.
  Two overlapping runs for one terminal can now produce one malformed file, which the mod rejects and the next run repairs.
- 2026-11-23 (Checkpoint B review): A unit test runs the real `~/.claude/statusline.sh` against a temporary home and reads the result with `parseFeed`, so a renamed field on either side fails a test instead of blanking the readout.
  It is skipped where the script or `jq` is absent.
- 2026-11-23 (Checkpoint B review): The write-time upper bound (`written_at` not after now) stays.
  It costs one comparison and keeps the rule "between its terminal's start and now" whole; a backward clock step blanks the readout only until the next status line run.
- 2026-11-23 (Task 5): The dirty mark is built in the clone; the shipped `spaces` mod has none, though the plan called it shipped.
  It is one `git status --porcelain` per place inside the existing refresh, with the flags the shipped `worktree` dialog uses (`--no-optional-locks -c core.fsmonitor=false`), so the read never writes the index and cannot wake the repo's own folder watch.
  A place now runs up to three git reads at once, so the concurrency cap went from 6 to 5 places to stay under a machine core's 16 running execs.
  Edits that do not touch `.git` show up when a command or an agent's turn ends, or at the 60s fallback.
- 2026-11-23 (Task 5): The title is cut after 2 lines at a word boundary, with no ellipsis.
  This gpui-kit build has no line clamp and no way to measure text (`line_clamp` is not a function on an element), so an ellipsis on the second line cannot be placed; the tooltip carries the full title.
  The branch uses the native `text_ellipsis_middle`, so no character budget is guessed.
- 2026-11-23 (Task 5): Line 1 is the repo name; outside a repo it is Herdr's own name for the space, or the folder name once the space has a typed name, because that name is then the title (`cardHead`).
  The avatar letter follows line 1.
  A detached head is stored as no branch and shown as "detached", so title rule 3 is skipped for it.
- 2026-11-23 (Task 5): Title rule 2 reads only the most recently active agent.
  When that agent's title is not telling, the title falls through to the branch rather than to an older agent's title, which could describe work that is no longer current.
- 2026-11-23 (Task 5): A repo space on `main` with no agent gets the title "Main" by rule 3, repeating line 3.
  Left as specified; revisit if it reads badly in daily use.
- 2026-11-23 (Task 5): The app is now 0.1.17 and its shipped `spaces` mod names a hidden bare repo (`<project>/.bare`) after its project folder; the clone, taken from 0.1.16, does not.
  Not adopted here; the README step at Checkpoint D covers re-diffing the clones.
- 2026-11-23 (Task 6): The state slot's times come from Herdr, not from stamps the mod keeps.
  Working shows the time since the earliest `working_since` among the space's tabs, so the card says how long the space has been at work.
  Idle, or no agent, shows the age of the latest `changed_at` among its tabs.
  Herdr reports no `changed_at` for a tab in which nothing changed since the app started, and the card then shows no age rather than a guess; a space that never had an agent stays blank.
  The agents list keeps its own stamps across restarts, so after a restart an idle agent's row can show a time while its card shows none.
- 2026-11-23 (Task 6): Under a minute the working slot reads `<1m`, as the agents list does, and the idle slot reads `just now`.
  Counting seconds would redraw the window every second; the cards redraw every 30s for the minute count, as the agents list does.
  The two lists tick on their own timers, so the same time can read one minute apart for up to 30s.
- 2026-11-23 (Task 6): Line 3 shows each agent program once, however many agents of it the space has.
  The count of agents is the agents list's job, and one icon per agent would take the branch's room.
- 2026-11-23 (Task 6): The card's context reading is described in the card's own tooltip, as its last line, not in a tooltip on the percentage.
  A tooltip inside a tooltip's area could not be tried without a pointer, and one tooltip per card says everything the card shortens.
- 2026-11-23 (Task 6): `spaces-cards` reads the feed itself on its own 5s timer, with its own copy of `context.js`.
  The card and the agent rows can therefore differ for up to 5s after a feed changes.
- 2026-11-23 (Task 6): Blocked, working, done and idle were captured with a real Claude Code agent in the scratch repo space, and orange and red on the card with a second agent there and temporary feeds of 75 and 95.
  Both agents' tabs and feed files were removed afterwards.
- 2026-11-23 (Task 7): "After all repo spaces" holds per machine: a space outside any repo follows the repos of its own machine.
  Herdr keeps each machine's spaces together and `space.move` stays inside a machine's block, so a move across machines could never settle.
- 2026-11-23 (Task 7): A space counts as outside a repo only when git itself said "not a git repository" for its place, or when it has no folder at all.
  While git has not answered for one space of a machine (a new space, a `cd`, a machine that is away), nothing on that machine is moved last; worktree nesting still applies.
  Guessing either way would shuffle spaces as the answers arrive after a start or a reload.
- 2026-11-23 (Task 7): The rule holds against a drag too.
  A space outside a repo dropped among the repos, or a repo space dropped below them, goes back within a moment, and the drop line is still drawn there, as it already is for a worktree space dragged away from its checkout.
  Reordering among repo spaces, and among the spaces outside a repo, stays as dropped.
- 2026-11-23 (Task 7): A space is where its first terminal is, as shipped, so a `cd` out of a repo in that terminal sends its card last and shifts the `ctrl-N` numbers after it.
- 2026-11-23 (Task 7): The drawn order and the moves that make the real order match it are `visualOrder` and `plannedMoves` in `model.js`.
  When and how often the moves run (once per change, then one retry a second while the machine's layout is ready) is the shipped code, unchanged.
- 2026-11-23 (Task 7): Checked in the live window with a temporary space in `~`, moved by command to place 1 and to place 3: it was back in last place within 0.2s both times, and `space.select --index` 1 to 5 lit the card at that place.
  A repo space moved among the repos stayed, a reload with the `~` space open moved nothing, and a new scratch repo space made after it landed above it.
  The temporary spaces were closed afterwards.
- 2026-11-23 (Checkpoint C test): The avatar letter is the first letter or digit of line 1, not its first character as shipped.
  `.config` drew a dot in its avatar; it now draws a C (`avatarLetter` in `model.js`).
  A name with no letter or digit, such as `~`, keeps its first character.
- 2026-11-23 (Checkpoint C test): An agent in a tab that is not its space's selected tab stays "Done" when the space is selected.
  Herdr counts an agent as looked at only when its own tab is shown, so the card turns to an age once that tab is opened.
- 2026-11-23 (Checkpoint C review): Title rule 1 skips a tab whose name is the program name of an agent in it.
  The tab bar's + menu starts an agent with `tab.new {name: <program name>}`, which marks the tab `named`, so every space started that way was titled "Claude Code".
  The shipped agents list has the same exemption for its rows.
  A tab the user really named like a program that runs in it is skipped too; the name is still on the tab.
- 2026-11-23 (Checkpoint C review): Only a place that has not been looked at yet holds back "outside a repo goes last" on its machine; this narrows the Task 7 entry above.
  A place git was asked about and could not answer for (a folder that is gone, a bare repo, a machine that is away) stays where it is among the repos and no longer blocks the others, because such a place can stay unanswered for as long as its space is open and the rule would be off the whole time.
  The cost: when such a place later gets git's "not a repository", its space joins the end of the spaces outside a repo, which can put it after one it used to be above.
  The decision is `standing` in `model.js`, with tests.
- 2026-11-23 (Checkpoint C review): A place stays "not answered" until git's answer lands, not until the next look at it starts.
  The mark was cleared when a look began, so for the length of each 60s re-ask a place git could not read counted as outside a repo and its space could be moved last and back.
- 2026-11-23 (Checkpoint C review): The dirty mark's `git status` no longer decides whether the place has a repo.
  It is the one read that scans the worktree; when it cannot finish, the place keeps its repo, branch and nesting from the ref reads and shows no dirty mark.
- 2026-11-23 (Checkpoint C review): `visualOrder` marks a nested row with `nested: true`; the shipped `├─` and `└─` marks were kept by the clone but never drawn on a card.
- 2026-11-23 (Checkpoint C review): `plannedMoves` is the shipped algorithm and is not minimal: a space that goes from first to last among N plans N - 1 moves.
  Left as is; it happens once, when a space outside a repo is first sent last, and each later render plans none.
  A unit test pins that the index counts places across every machine, as shipped; a live check on a remote machine is still open.

## Open questions

1. ~~**`HC_TERMINAL_ID` inheritance.**~~
   Settled 2026-11-23 in plan task 3: it is inherited, see the decisions log.
2. ~~**Unit test files inside mod folders.**~~
   Settled 2026-11-22 in plan task 2: they stay in the mod folders, see the decisions log.
