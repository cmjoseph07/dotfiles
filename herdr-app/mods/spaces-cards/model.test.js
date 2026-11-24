import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterLook, age, agentPrograms, avatarLetter, base, cardHead, cardState, cardTitle, cardTooltip, checkout, dirtyAfter, elapsed, gitInfo, highestContext, plannedMoves, readableBranch, standing, tellingTitle, visualOrder } from "./model.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const claude = { name: "Claude Code", key: "claude" };
const agent = (title, extra = {}) => ({ address: "t4", tab: "tab1", title, program: claude, seq: 1, ...extra });
const space = (extra = {}) => ({ name: "lanternhall", named: false, tabs: [{ id: "tab1", name: "1", named: false, active: true }], ...extra });

test("readableBranch drops the prefix and reads as a sentence", () => {
  assert.equal(readableBranch("feat/analyze-in-daemon"), "Analyze in daemon");
  assert.equal(readableBranch("fix/ui/long_branch-name"), "Long branch name");
  assert.equal(readableBranch("main"), "Main");
});

test("readableBranch keeps a branch that has no readable leaf", () => {
  assert.equal(readableBranch("feat/"), "feat/");
  assert.equal(readableBranch("--"), "--");
});

test("base is the last folder of a path", () => {
  assert.equal(base("/Users/me/Development/lanternhall"), "lanternhall");
  assert.equal(base("/Users/me/Development/lanternhall/"), "lanternhall");
});

test("base of no folder, or of the root, is empty", () => {
  assert.equal(base(""), "");
  assert.equal(base("/"), "");
});

test("tellingTitle keeps what the agent says it is doing", () => {
  assert.equal(tellingTitle(agent("Fix the login redirect")), "Fix the login redirect");
});

test("tellingTitle drops the status glyph an agent puts before its title", () => {
  assert.equal(tellingTitle(agent("✳ Fix the login redirect")), "Fix the login redirect");
  assert.equal(tellingTitle(agent("⠋ - Thinking about cards")), "Thinking about cards");
  assert.equal(tellingTitle(agent("[ ! ] Review the diff")), "Review the diff");
  assert.equal(tellingTitle(agent("[ . ] Review the diff")), "Review the diff");
  assert.equal(tellingTitle(agent("[web] login")), "[web] login");
});

test("tellingTitle keeps a title that starts with a curly opening quote, and trims what follows it", () => {
  assert.equal(tellingTitle(agent("“Quoted” title")), "“Quoted” title");
  assert.equal(tellingTitle(agent("Fix login  ")), "Fix login");
});

test("tellingTitle is one line of plain text, whatever the program in the terminal wrote", () => {
  assert.equal(tellingTitle(agent("Fix login\nContext 3%")), "Fix login Context 3%");
  assert.equal(tellingTitle(agent("Fix\t the \u0007 login")), "Fix the login");
  assert.equal(tellingTitle(agent("Fix \u202elogin\u2069")), "Fix login");
  assert.equal(tellingTitle(agent("Ship 👨‍👩‍👧 mode")), "Ship 👨‍👩‍👧 mode");
  assert.equal(tellingTitle(agent("x".repeat(5000))).length, 200);
});

test("tellingTitle rejects a path", () => {
  assert.equal(tellingTitle(agent("~/Development/lanternhall")), "");
  assert.equal(tellingTitle(agent("/Users/me/code")), "");
  assert.equal(tellingTitle(agent("✳ ~/Development")), "");
  assert.equal(tellingTitle(agent("C:\\Users\\me")), "");
});

test("tellingTitle rejects the terminal's own address", () => {
  assert.equal(tellingTitle(agent("t4")), "");
});

test("tellingTitle rejects the program's name and key", () => {
  assert.equal(tellingTitle(agent("Claude Code")), "");
  assert.equal(tellingTitle(agent("✳ Claude Code")), "");
  assert.equal(tellingTitle(agent("claude")), "");
  assert.equal(tellingTitle(agent("Claude")), "");
});

test("tellingTitle rejects anything containing @", () => {
  assert.equal(tellingTitle(agent("me@macbook: ~/code")), "");
});

test("tellingTitle rejects an empty or missing title", () => {
  assert.equal(tellingTitle(agent("")), "");
  assert.equal(tellingTitle(agent(null)), "");
  assert.equal(tellingTitle(agent("✳ ")), "");
  assert.equal(tellingTitle(undefined), "");
});

test("title rule 1: the name the user typed for the space wins", () => {
  const title = cardTitle({
    space: space({ name: "Billing rewrite", named: true }),
    agents: [agent("Fix the login redirect")],
    branch: "feat/analyze-in-daemon",
    folder: "/Users/me/lanternhall",
  });
  assert.equal(title, "Billing rewrite");
});

test("title rule 1: a tab the user named wins when the space is unnamed", () => {
  const tabs = [{ name: "1", named: false, active: false }, { name: "fix login", named: true, active: false }];
  const title = cardTitle({ space: space({ tabs }), agents: [agent("Refactor the parser")], branch: "main", folder: "/Users/me/lanternhall" });
  assert.equal(title, "fix login");
});

test("title rule 1: among named tabs the shown one wins", () => {
  const tabs = [{ name: "fix login", named: true, active: false }, { name: "ship cards", named: true, active: true }];
  assert.equal(cardTitle({ space: space({ tabs }), agents: [], branch: null, folder: "/Users/me/lanternhall" }), "ship cards");
});

// The + menu names a new agent's tab after its program: nobody typed that.
const menuTab = { id: "tab1", name: "Claude Code", named: true, active: true };

test("title rule 1 skips a tab named after the agent the + menu started in it", () => {
  const agents = [agent("✳ Build the card sidebar", { tab: "tab1" })];
  assert.equal(cardTitle({ space: space({ tabs: [menuTab] }), agents, branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall" }), "Build the card sidebar");
});

test("title rule 1 skips such a tab down to the branch when its agent's title is not telling", () => {
  const agents = [agent("Claude Code", { tab: "tab1" })];
  assert.equal(cardTitle({ space: space({ tabs: [menuTab] }), agents, branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall" }), "Analyze in daemon");
});

test("title rule 1 skips such a tab for a tab the user did name", () => {
  const tabs = [menuTab, { id: "tab2", name: "fix login", named: true, active: false }];
  const agents = [agent("✳ Build the card sidebar", { tab: "tab1" })];
  assert.equal(cardTitle({ space: space({ tabs }), agents, branch: "main", folder: "/Users/me/lanternhall" }), "fix login");
});

test("title rule 1 keeps a tab the user named like a program the + menu does not start", () => {
  const tabs = [{ id: "tab1", name: "Lazygit", named: true, active: true }];
  const agents = [agent("✳ Build the card sidebar", { tab: "tab2" })];
  assert.equal(cardTitle({ space: space({ tabs }), agents, branch: "main", folder: "/Users/me/lanternhall", menuNames: new Set(["Claude Code", "Codex"]) }), "Lazygit");
});

test("title rule 1 passes over a name with nothing to draw", () => {
  const tabs = [{ id: "tab1", name: "\u0007", named: true, active: true }];
  assert.equal(cardTitle({ space: space({ name: "\n", named: true, tabs }), agents: [], branch: "main", folder: "/Users/me/lanternhall" }), "Main");
});

// A name with a line break and a mark that turns the text after it around.
const odd = "a\nb\u202e";

test("cardTitle is one line of plain text, whichever rule gives it", () => {
  const folder = "/Users/me/lanternhall";
  assert.equal(cardTitle({ space: space({ name: odd, named: true }), agents: [], branch: "main", folder }), "a b");
  assert.equal(cardTitle({ space: space({ tabs: [{ id: "tab1", name: odd, named: true, active: true }] }), agents: [], branch: "main", folder }), "a b");
  assert.equal(cardTitle({ space: space(), agents: [], branch: null, folder: `/Users/me/${odd}` }), "a b");
  assert.equal(cardTitle({ space: space({ name: odd }), agents: [], branch: null, folder: "" }), "a b");
});

test("a space with nothing to say beyond its folder has a title equal to its first line, which the card then draws once", () => {
  for (const [name, folder] of [["notes", "/Users/me/notes"], ["out-a", "/tmp/out-a/"]]) {
    const unnamed = space({ name });
    assert.equal(cardTitle({ space: unnamed, agents: [], branch: null, folder }), cardHead({ space: unnamed, repo: null, folder }));
  }
});

// The names the + menu gives the tabs it makes, as main.js learns them from knownAgents().
const menuNames = new Set(["Claude Code", "Codex"]);

test("title rule 1 skips a tab the + menu named once its agent is gone, or before it reports", () => {
  assert.equal(cardTitle({ space: space({ tabs: [menuTab] }), agents: [], branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall", menuNames }), "Analyze in daemon");
});

test("title rule 1 skips a tab the + menu named when another program runs in it", () => {
  const agents = [agent("✳ Review the diff", { tab: "tab1", program: { name: "Codex", key: "codex" } })];
  assert.equal(cardTitle({ space: space({ tabs: [menuTab] }), agents, branch: "main", folder: "/Users/me/lanternhall", menuNames }), "Review the diff");
});

test("title rule 1 keeps a typed tab name the + menu never gives", () => {
  const tabs = [{ id: "tab1", name: "fix login", named: true, active: true }];
  assert.equal(cardTitle({ space: space({ tabs }), agents: [], branch: "main", folder: "/Users/me/lanternhall", menuNames }), "fix login");
});

test("title rule 2: the most recently active agent's telling title", () => {
  const agents = [
    agent("✳ Refactor the parser", { address: "t1", seq: 3 }),
    agent("✳ Build the card sidebar", { address: "t4", seq: 9 }),
    agent("✳ Write the changelog", { address: "t6", seq: 5 }),
  ];
  assert.equal(cardTitle({ space: space(), agents, branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall" }), "Build the card sidebar");
});

test("title rule 2 gives way when the most recent agent's title is not telling", () => {
  for (const title of ["~/Development/lanternhall", "t9", "Claude Code", "claude", "me@macbook"]) {
    const agents = [agent("✳ Refactor the parser", { address: "t1", seq: 3 }), agent(title, { address: "t9", seq: 9 })];
    assert.equal(cardTitle({ space: space(), agents, branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall" }), "Analyze in daemon", title);
  }
});

test("title rule 2: of two agents equally recent, the first one's title", () => {
  const agents = [agent("✳ Refactor the parser", { address: "t1", seq: 4 }), agent("✳ Write the docs", { address: "t2", seq: 4 })];
  assert.equal(cardTitle({ space: space(), agents, branch: "main", folder: "/Users/me/lanternhall" }), "Refactor the parser");
});

test("title rule 3: the branch, made readable", () => {
  assert.equal(cardTitle({ space: space(), agents: [], branch: "feat/analyze-in-daemon", folder: "/Users/me/lanternhall" }), "Analyze in daemon");
});

test("title rule 4: the folder name, outside a repo or on a detached head", () => {
  assert.equal(cardTitle({ space: space({ name: "~" }), agents: [], branch: null, folder: "/Users/me" }), "me");
  assert.equal(cardTitle({ space: space(), agents: [agent("claude")], branch: null, folder: "/Users/me/notes/" }), "notes");
});

test("title rule 4 falls back to the space's name when it has no folder", () => {
  assert.equal(cardTitle({ space: space({ name: "~" }), agents: [], branch: null, folder: "" }), "~");
});

test("avatarLetter is the first letter or digit of a card's first line, in upper case", () => {
  assert.equal(avatarLetter("lanternhall"), "L");
  assert.equal(avatarLetter("9lives"), "9");
  assert.equal(avatarLetter("\u00e9mile"), "\u00c9");
});

test("avatarLetter skips the punctuation a name starts with", () => {
  assert.equal(avatarLetter(".config"), "C");
  assert.equal(avatarLetter("_scratch"), "S");
});

test("avatarLetter keeps the first character of a name with no letter or digit", () => {
  assert.equal(avatarLetter("~"), "~");
  assert.equal(avatarLetter("..."), ".");
});

test("avatarLetter of an empty name is a question mark", () => {
  assert.equal(avatarLetter(""), "?");
});

test("cardHead is the repo, whatever the space is called", () => {
  assert.equal(cardHead({ space: space(), repo: "lanternhall", folder: "/Users/me/lanternhall" }), "lanternhall");
  assert.equal(cardHead({ space: space({ name: "Billing rewrite", named: true }), repo: "lanternhall", folder: "/Users/me/worktrees/lanternhall/billing" }), "lanternhall");
});

test("cardHead outside a repo is Herdr's own name for the space", () => {
  assert.equal(cardHead({ space: space({ name: "~" }), repo: null, folder: "/Users/me" }), "~");
  assert.equal(cardHead({ space: space({ name: "notes" }), repo: null, folder: "/Users/me/notes" }), "notes");
});

test("cardHead outside a repo is the folder once the space has a typed name, which is the title", () => {
  assert.equal(cardHead({ space: space({ name: "Scratch pad", named: true }), repo: null, folder: "/Users/me/notes" }), "notes");
  assert.equal(cardHead({ space: space({ name: "Scratch pad", named: true }), repo: null, folder: "" }), "Scratch pad");
});

test("cardHead is one line of plain text", () => {
  assert.equal(cardHead({ space: space(), repo: odd, folder: "/Users/me/lanternhall" }), "a b");
  assert.equal(cardHead({ space: space({ name: odd }), repo: null, folder: "/Users/me/x" }), "a b");
});

test("cardTooltip lists the full title, branch and folder", () => {
  assert.equal(
    cardTooltip({ title: "Build the card sidebar", branch: "feat/a-very-long-branch-name-that-the-card-cuts-in-the-middle", folder: "/Users/me/lanternhall" }),
    "Build the card sidebar\nfeat/a-very-long-branch-name-that-the-card-cuts-in-the-middle\n/Users/me/lanternhall",
  );
});

test("cardTooltip keeps each part on its own line: a line break inside one cannot add a line", () => {
  assert.equal(
    cardTooltip({ title: "notes", branch: "main\nContext 3%", folder: "/tmp/a\nb" }),
    "notes\nmain Context 3%\n/tmp/a b",
  );
});

test("cardTooltip flattens its title too, and keeps the end of a folder too long to show whole", () => {
  assert.equal(cardTooltip({ title: odd, branch: null, folder: "" }), "a b");
  const long = `/Users/me/${"deep/".repeat(60)}leaf`;
  const shown = cardTooltip({ title: "", branch: null, folder: long });
  assert.equal([...shown].length, 200);
  assert.ok(shown.startsWith("…") && shown.endsWith("deep/leaf"), shown);
});

test("cardTooltip leaves out what the space does not have", () => {
  assert.equal(cardTooltip({ title: "notes", branch: null, folder: "/Users/me/notes" }), "notes\n/Users/me/notes");
});

test("cardTooltip adds the context reading when the card shows one", () => {
  assert.equal(
    cardTooltip({ title: "notes", branch: "main", folder: "/Users/me/notes", context: "Context 82% - 164k of 200k tokens" }),
    "notes\nmain\n/Users/me/notes\nContext 82% - 164k of 200k tokens",
  );
});

test("age is just now under a minute", () => {
  assert.equal(age(0), "just now");
  assert.equal(age(MINUTE - 1), "just now");
});

test("age counts minutes up to the hour", () => {
  assert.equal(age(MINUTE), "1m");
  assert.equal(age(5 * MINUTE), "5m");
  assert.equal(age(HOUR - 1), "59m");
});

test("age counts hours up to the day", () => {
  assert.equal(age(HOUR), "1h");
  assert.equal(age(2 * HOUR), "2h");
  assert.equal(age(DAY - 1), "23h");
});

test("age counts days from then on", () => {
  assert.equal(age(DAY), "1d");
  assert.equal(age(3 * DAY), "3d");
  assert.equal(age(45 * DAY), "45d");
});

test("age counts whole days: a day and a half is still one", () => {
  assert.equal(age(36 * HOUR), "1d");
  assert.equal(age(2 * DAY - 1), "1d");
});

test("age of a change stamped after now (a clock step) is just now", () => {
  assert.equal(age(-5 * MINUTE), "just now");
});

test("elapsed uses the same units, and under a minute says so without counting seconds", () => {
  assert.equal(elapsed(0), "<1m");
  assert.equal(elapsed(MINUTE - 1), "<1m");
  assert.equal(elapsed(3 * MINUTE), "3m");
  assert.equal(elapsed(2 * HOUR), "2h");
  assert.equal(elapsed(3 * DAY), "3d");
});

test("elapsed since a start stamped after now (a clock step) is under a minute", () => {
  assert.equal(elapsed(-5 * MINUTE), "<1m");
});

const NOW = 10 * DAY;
const tab = (extra = {}) => ({ name: "1", named: false, active: true, changed_at: null, working_since: null, ...extra });

test("cardState: blocked needs no time", () => {
  const s = space({ status: "blocked", tabs: [tab({ changed_at: NOW - HOUR, working_since: NOW - HOUR })] });
  assert.deepEqual(cardState({ space: s, now: NOW }), { status: "blocked", text: null });
});

test("cardState: done needs no time", () => {
  const s = space({ status: "done", tabs: [tab({ changed_at: NOW - HOUR })] });
  assert.deepEqual(cardState({ space: s, now: NOW }), { status: "done", text: null });
});

test("cardState: working shows how long, from the tab that has worked longest", () => {
  const tabs = [tab(), tab({ working_since: NOW - 3 * MINUTE }), tab({ working_since: NOW - 2 * HOUR })];
  assert.deepEqual(cardState({ space: space({ status: "working", tabs }), now: NOW }), { status: "working", text: "2h" });
});

test("cardState: working for under a minute says so, where an idle card would say just now", () => {
  const tabs = [tab({ working_since: NOW - 30_000 })];
  assert.deepEqual(cardState({ space: space({ status: "working", tabs }), now: NOW }), { status: "working", text: "<1m" });
});

test("cardState: working without a start time shows no time", () => {
  assert.deepEqual(cardState({ space: space({ status: "working", tabs: [tab()] }), now: NOW }), { status: "working", text: null });
});

test("cardState: idle shows the age of the most recent change in any tab", () => {
  const tabs = [tab({ changed_at: NOW - 3 * DAY }), tab({ changed_at: NOW - 5 * MINUTE }), tab()];
  assert.deepEqual(cardState({ space: space({ status: "idle", tabs }), now: NOW }), { status: "idle", text: "5m" });
});

test("cardState: a space with no agent is idle", () => {
  const s = space({ status: null, tabs: [tab({ changed_at: NOW - 30_000 })] });
  assert.deepEqual(cardState({ space: s, now: NOW }), { status: "idle", text: "just now" });
});

test("cardState: idle with nothing changed since the app started shows no age", () => {
  assert.deepEqual(cardState({ space: space({ status: "idle", tabs: [tab()] }), now: NOW }), { status: "idle", text: null });
  assert.deepEqual(cardState({ space: space({ status: null, tabs: undefined }), now: NOW }), { status: "idle", text: null });
});

test("cardState: a status it does not know shows no time", () => {
  const s = space({ status: "unknown", tabs: [tab({ changed_at: NOW - HOUR, working_since: NOW - HOUR })] });
  assert.deepEqual(cardState({ space: s, now: NOW }), { status: "unknown", text: null });
});

const reading = (percent) => ({ percent, tokens: percent * 2000, window: 200_000 });

test("highestContext is the fullest reading among the space's agents", () => {
  const readings = new Map([["t1", reading(42)], ["t4", reading(88)], ["t6", reading(61)], ["t9", reading(97)]]);
  const agents = [agent("a", { address: "t1" }), agent("b", { address: "t4" }), agent("c", { address: "t6" })];
  assert.deepEqual(highestContext(agents, readings), reading(88));
});

test("highestContext skips agents that have no reading", () => {
  const readings = new Map([["t4", reading(12)]]);
  assert.deepEqual(highestContext([agent("a", { address: "t1" }), agent("b", { address: "t4" })], readings), reading(12));
});

test("highestContext is null when no agent of the space has a reading", () => {
  assert.equal(highestContext([agent("a", { address: "t1" })], new Map([["t9", reading(97)]])), null);
  assert.equal(highestContext([], new Map([["t9", reading(97)]])), null);
});

test("highestContext counts a reading of 0", () => {
  assert.deepEqual(highestContext([agent("a", { address: "t1" })], new Map([["t1", reading(0)]])), reading(0));
});

test("highestContext of two equally full readings is the first agent's", () => {
  const first = { percent: 40, tokens: 80_000, window: 200_000 }, second = { percent: 40, tokens: 400_000, window: 1_000_000 };
  const agents = [agent("a", { address: "t1" }), agent("b", { address: "t2" })];
  assert.deepEqual(highestContext(agents, new Map([["t1", first], ["t2", second]])), first);
});

test("agentPrograms lists each program once, in the agents' order", () => {
  const codex = { name: "Codex", key: "codex", icon: "icons/codex.svg" };
  const claudeIcon = { ...claude, icon: "icons/claude.svg" };
  const agents = [agent("a", { program: claudeIcon }), agent("b", { program: codex }), agent("c", { program: claudeIcon })];
  assert.deepEqual(agentPrograms(agents), [claudeIcon, codex]);
});

test("agentPrograms leaves out a program that has no icon to draw", () => {
  assert.deepEqual(agentPrograms([agent("a", { program: { name: "Mystery", key: "agent", icon: null } }), agent("b", { program: undefined })]), []);
});

// Rows as main.js hands them over, in the real space order.
const inRepo = (id, repo, { linked = false, machine = null } = {}) => ({ w: { id, machine }, g: { repo: JSON.stringify([machine, repo]), linked }, outside: false, pending: false });
const outsideRepo = (id, machine = null) => ({ w: { id, machine }, g: null, outside: true, pending: false });
// Not looked at yet, and looked at without an answer from git.
const pending = (id, machine = null) => ({ w: { id, machine }, g: null, outside: false, pending: true });
const unanswered = (id, machine = null) => ({ w: { id, machine }, g: null, outside: false, pending: false });
const ids = (rows) => rows.map((r) => r.w.id);
// What Herdr does with the planned moves: each takes its space to a 1-based place.
const moved = (order, moves) => moves.reduce((now, { id, index }) => {
  const rest = now.filter((other) => other !== id);
  return [...rest.slice(0, index - 1), id, ...rest.slice(index - 1)];
}, order);

const info = { repo: JSON.stringify([null, "/a/.git"]), linked: false };

test("afterLook: git's answer replaces what the place knew", () => {
  assert.equal(afterLook(undefined, null), null);
  assert.equal(afterLook(undefined, info), info);
  assert.equal(afterLook(null, info), info);
  assert.equal(afterLook(info, null), null);
  assert.equal(afterLook(false, null), null);
});

test("afterLook: a look that could not ask leaves what git said before", () => {
  assert.equal(afterLook(null, undefined), null);
  assert.equal(afterLook(info, undefined), info);
});

test("afterLook: a place git has never answered for is looked at, and still unknown", () => {
  assert.equal(afterLook(undefined, undefined), false);
  assert.equal(afterLook(false, undefined), false);
});

test("standing: a space with no folder is outside any repo, whatever git knows", () => {
  assert.deepEqual(standing({ folder: "", git: undefined }), { outside: true, pending: false });
});

test("standing: a place is pending until its first look ends", () => {
  assert.deepEqual(standing({ folder: "/a", git: undefined }), { outside: false, pending: true });
});

test("standing: a place is outside a repo on git's own no", () => {
  assert.deepEqual(standing({ folder: "/a", git: null }), { outside: true, pending: false });
});

test("standing: a place git never answered for is neither outside nor pending", () => {
  assert.deepEqual(standing({ folder: "/a", git: false }), { outside: false, pending: false });
});

test("standing: a place in a repo is neither", () => {
  assert.deepEqual(standing({ folder: "/a", git: info }), { outside: false, pending: false });
});

// The real order after the sidebar has looked at every place: `known` is each space's
// place as git last answered, in the real order.
const settle = (known) => {
  const rows = Object.entries(known).map(([id, git]) => ({ w: { id, machine: null }, g: git || null, ...standing({ folder: `/${id}`, git }) }));
  return moved(ids(rows), plannedMoves(ids(rows), ids(visualOrder(rows))));
};

test("a space outside a repo stays where it is when a later look at its place fails", () => {
  const known = { a: info, home: null, tmp: null, notes: null };
  assert.deepEqual(settle(known), ["a", "home", "tmp", "notes"]);
  known.tmp = afterLook(known.tmp, undefined);
  assert.deepEqual(settle(known), ["a", "home", "tmp", "notes"]);
  known.tmp = afterLook(known.tmp, null);
  assert.deepEqual(settle(known), ["a", "home", "tmp", "notes"]);
});

test("a space git never answered for stays among the repos, and joins the spaces outside one on git's own no", () => {
  const known = { gone: afterLook(undefined, undefined), a: info, home: null };
  assert.deepEqual(settle(known), ["gone", "a", "home"]);
  known.gone = afterLook(known.gone, null);
  assert.deepEqual(settle(known), ["a", "gone", "home"]);
});

const ran = (stdout, extra = {}) => ({ code: 0, stdout, stderr: "", ...extra });
const failed = (stderr, code = 128) => ({ code, stdout: "", stderr });

test("checkout: the place's top folder and its repo's own folder", () => {
  assert.deepEqual(checkout(ran("/a\n"), ran("/a/.git\n")), { top: "/a", repo: "/a/.git" });
});

test("checkout keeps a line break that is part of a folder's name", () => {
  assert.deepEqual(checkout(ran("/a\nb\n"), ran("/a\nb/.git\n")), { top: "/a\nb", repo: "/a\nb/.git" });
});

test("checkout keeps a line break a folder's name ends with", () => {
  assert.deepEqual(checkout(ran("/a\n\n"), ran("/a\n/.git\n")), { top: "/a\n", repo: "/a\n/.git" });
});

test("checkout is null on git's own word that the place is in no repo", () => {
  const no = failed("fatal: not a git repository (or any of the parent directories): .git\n");
  assert.equal(checkout(no, no), null);
  assert.equal(checkout(ran("/a\n"), no), null);
  assert.equal(checkout(failed("fatal: Not a git repository\n"), no), null);
});

test("checkout is undefined when git failed for any other reason: asked again, not believed", () => {
  const no = failed("fatal: not a git repository (or any of the parent directories): .git\n");
  for (const stderr of [
    "fatal: this operation must be run in a work tree\n",
    "fatal: invalid gitfile format: /tmp/x/.git\n",
    "fatal: cannot use bare repository '/tmp/x' (safe.bareRepository is 'explicit')\n",
    "fatal: detected dubious ownership in repository at '/tmp/x'\n",
    "",
  ]) {
    assert.equal(checkout(failed(stderr), ran("/a/.git\n")), undefined, stderr);
    assert.equal(checkout(ran("/a\n"), failed(stderr)), undefined, stderr);
  }
  // The first read that failed speaks: a later "no" does not turn it into one.
  assert.equal(checkout(failed("fatal: this operation must be run in a work tree\n"), no), undefined);
});

const refs = (extra = {}) => ({ machine: null, top: "/code/lanternhall", repo: "/code/lanternhall/.git", branch: ran("refs/heads/feat/cards\n"), counts: ran("2\t3\n"), dirty: false, ...extra });

test("gitInfo: the repo's name, the branch and how far it is from its upstream", () => {
  assert.deepEqual(gitInfo(refs()), { name: "lanternhall", branch: "feat/cards", ahead: 2, behind: 3, dirty: false, repo: JSON.stringify([null, "/code/lanternhall/.git"]), linked: false });
});

test("gitInfo names a bare repo after its folder, without the .git", () => {
  assert.equal(gitInfo(refs({ top: "/code/worktrees/cards", repo: "/code/lanternhall.git" })).name, "lanternhall");
});

test("gitInfo: a detached head has no branch", () => {
  assert.equal(gitInfo(refs({ branch: failed("", 1) })).branch, null);
});

test("gitInfo: a branch with no upstream is neither ahead nor behind", () => {
  const g = gitInfo(refs({ counts: failed("fatal: no upstream configured for branch 'feat/cards'\n") }));
  assert.deepEqual([g.ahead, g.behind], [0, 0]);
});

test("gitInfo: a worktree is linked, its main checkout is not", () => {
  assert.equal(gitInfo(refs({ top: "/code/worktrees/cards" })).linked, true);
  assert.equal(gitInfo(refs()).linked, false);
});

test("gitInfo: the same repo path on another machine is another repo", () => {
  assert.notEqual(gitInfo(refs({ machine: "vps" })).repo, gitInfo(refs()).repo);
  assert.equal(gitInfo(refs({ machine: "vps" })).repo, JSON.stringify(["vps", "/code/lanternhall/.git"]));
});

test("gitInfo carries the dirty mark it is given", () => {
  assert.equal(gitInfo(refs({ dirty: true })).dirty, true);
});

test("gitInfo draws the repo's name and the branch as one plain line each", () => {
  assert.equal(gitInfo(refs({ branch: ran("refs/heads/feat/cards\nContext 3%\n") })).branch, "feat/cards Context 3%");
  assert.equal(gitInfo(refs({ repo: `/code/${odd}/.git` })).name, "a b");
});

test("gitInfo cuts a branch too long to draw after its refs/heads/ is gone", () => {
  assert.equal(gitInfo(refs({ branch: ran(`refs/heads/${"b".repeat(300)}\n`) })).branch, "b".repeat(200));
});

test("dirtyAfter: uncommitted changes are any line of a status that ran", () => {
  assert.equal(dirtyAfter(false, ran(" M main.js\n")), true);
  assert.equal(dirtyAfter(true, ran("")), false);
});

test("dirtyAfter: a status that failed, or could not finish, leaves the mark as it was", () => {
  for (const was of [true, false]) {
    assert.equal(dirtyAfter(was, failed("fatal: not a git repository\n")), was);
    assert.equal(dirtyAfter(was, ran(" M main.js\n", { code: 1 })), was);
    assert.equal(dirtyAfter(was, null), was);
  }
});

test("visualOrder of no spaces is empty", () => {
  assert.deepEqual(visualOrder([]), []);
});

test("visualOrder draws a space outside any repo after every repo group", () => {
  const rows = [outsideRepo("home"), inRepo("a", "/a/.git"), inRepo("b", "/b/.git")];
  assert.deepEqual(ids(visualOrder(rows)), ["a", "b", "home"]);
});

test("visualOrder keeps repo spaces, and spaces outside a repo, in their own real order", () => {
  const rows = [outsideRepo("tmp"), inRepo("b", "/b/.git"), outsideRepo("home"), inRepo("a", "/a/.git")];
  assert.deepEqual(ids(visualOrder(rows)), ["b", "a", "tmp", "home"]);
});

test("visualOrder puts worktree spaces under their main checkout's, before the spaces outside a repo", () => {
  const rows = [inRepo("wt1", "/a/.git", { linked: true }), outsideRepo("home"), inRepo("main", "/a/.git"), inRepo("wt2", "/a/.git", { linked: true })];
  assert.deepEqual(visualOrder(rows).map((r) => [r.w.id, r.nested]), [["main", false], ["wt1", true], ["wt2", true], ["home", false]]);
});

test("visualOrder lists a repo's worktrees once, under the first space in its main checkout", () => {
  const rows = [inRepo("main", "/a/.git"), inRepo("again", "/a/.git"), inRepo("wt", "/a/.git", { linked: true })];
  assert.deepEqual(visualOrder(rows).map((r) => [r.w.id, r.nested]), [["main", false], ["wt", true], ["again", false]]);
});

test("visualOrder leaves a worktree space among the repos when its main checkout is not open", () => {
  const rows = [outsideRepo("home"), inRepo("wt", "/a/.git", { linked: true }), inRepo("b", "/b/.git")];
  assert.deepEqual(visualOrder(rows).map((r) => [r.w.id, r.nested]), [["wt", false], ["b", false], ["home", false]]);
});

test("visualOrder keeps each machine's spaces together: outside a repo goes last on its own machine", () => {
  const rows = [outsideRepo("home"), inRepo("a", "/a/.git"), outsideRepo("vps-home", "vps"), inRepo("vps-a", "/a/.git", { machine: "vps" })];
  assert.deepEqual(ids(visualOrder(rows)), ["a", "home", "vps-a", "vps-home"]);
});

test("visualOrder moves nothing last on a machine while one of its spaces has not been looked at", () => {
  const rows = [outsideRepo("home"), inRepo("a", "/a/.git"), pending("new"), outsideRepo("vps-home", "vps"), inRepo("vps-a", "/a/.git", { machine: "vps" })];
  assert.deepEqual(ids(visualOrder(rows)), ["home", "a", "new", "vps-a", "vps-home"]);
});

test("visualOrder still nests worktrees while another space has not been looked at", () => {
  const rows = [inRepo("wt", "/a/.git", { linked: true }), pending("new"), inRepo("main", "/a/.git")];
  assert.deepEqual(ids(visualOrder(rows)), ["new", "main", "wt"]);
});

test("visualOrder keeps a space git could not answer for in place, and it holds nothing back", () => {
  const rows = [outsideRepo("home"), unanswered("gone"), inRepo("a", "/a/.git")];
  assert.deepEqual(ids(visualOrder(rows)), ["gone", "a", "home"]);
});

test("visualOrder hands each row back whole", () => {
  const row = { ...inRepo("a", "/a/.git"), folder: "/a", i: 0 };
  assert.deepEqual(visualOrder([row]), [{ ...row, nested: false }]);
});

test("visualOrder of its own result changes nothing", () => {
  const rows = [outsideRepo("tmp"), inRepo("wt", "/a/.git", { linked: true }), inRepo("b", "/b/.git"), outsideRepo("vps-home", "vps"), outsideRepo("home"), inRepo("main", "/a/.git"), inRepo("vps-a", "/a/.git", { machine: "vps" })];
  const once = visualOrder(rows);
  assert.deepEqual(visualOrder(once), once);
});

test("plannedMoves plans no space.move when the real order is already the visual one", () => {
  const rows = [inRepo("main", "/a/.git"), inRepo("wt", "/a/.git", { linked: true }), inRepo("b", "/b/.git"), outsideRepo("home"), inRepo("vps-a", "/a/.git", { machine: "vps" }), outsideRepo("vps-home", "vps")];
  assert.deepEqual(plannedMoves(ids(rows), ids(visualOrder(rows))), []);
});

test("plannedMoves gives each space its 1-based place, counting the moves before it as done", () => {
  assert.deepEqual(plannedMoves(["home", "a", "b"], ["a", "b", "home"]), [{ id: "a", index: 1 }, { id: "b", index: 2 }]);
  assert.deepEqual(plannedMoves(["a", "c", "b"], ["a", "b", "c"]), [{ id: "b", index: 2 }]);
});

test("plannedMoves counts places across every machine, as space.move does", () => {
  assert.deepEqual(plannedMoves(["a", "vps-home", "vps-a"], ["a", "vps-a", "vps-home"]), [{ id: "vps-a", index: 2 }]);
});

test("plannedMoves plans nothing for an id the real order does not have", () => {
  assert.deepEqual(plannedMoves(["a", "b"], ["b", "ghost", "a"]), [{ id: "b", index: 1 }]);
});

test("plannedMoves, once run, leave nothing to move", () => {
  const rows = [outsideRepo("tmp"), inRepo("wt", "/a/.git", { linked: true }), inRepo("b", "/b/.git"), outsideRepo("home"), inRepo("main", "/a/.git"), inRepo("vps-a", "/a/.git", { machine: "vps" })];
  const target = ids(visualOrder(rows));
  const after = moved(ids(rows), plannedMoves(ids(rows), target));
  assert.deepEqual(after, target);
  assert.deepEqual(plannedMoves(after, target), []);
});

test("context.js is byte for byte the copy in agents-context", () => {
  const mine = readFileSync(new URL("./context.js", import.meta.url));
  const theirs = readFileSync(new URL("../agents-context/context.js", import.meta.url));
  assert.ok(mine.equals(theirs), "spaces-cards/context.js and agents-context/context.js differ: change both, they cannot import each other");
});
