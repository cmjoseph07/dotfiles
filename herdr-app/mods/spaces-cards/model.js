// Pure decisions for the space cards: no herdr or gpui-kit import, so Node can test them.

export const base = (path) => path.replace(/\/+$/, "").split("/").pop();

export function readableBranch(branch) {
  const leaf = branch.slice(branch.lastIndexOf("/") + 1).replace(/[-_]+/g, " ").trim();
  return leaf ? leaf[0].toUpperCase() + leaf.slice(1) : branch;
}

// One line of plain text from a string someone else chose: a program's title, a branch a
// machine reported, a folder's name. Line breaks and control characters become one space,
// the marks that reorder the text around them are dropped, and it ends after LONGEST
// characters. What a card or its tooltip draws goes through here, so none of it can add a
// line or pass for another part of the card.
const LONGEST = 200;
const flat = (s) => (s ?? "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/[\p{Cc}\s]+/gu, " ").trim();
const plain = (s) => [...flat(s)].slice(0, LONGEST).join("");
// A path too long to draw keeps its end, the folder it leads to.
const plainPath = (s) => {
  const all = [...flat(s)];
  return all.length > LONGEST ? `…${all.slice(1 - LONGEST).join("")}` : all.join("");
};

// Drops what an agent puts before its title: a status glyph or spinner and the separator
// after it ("✦  Working", "⠋ - Thinking"), and Codex's blinking "[ ! ] " / "[ . ] " mark.
// Stops at an opening bracket or curly quote, so a title that starts with one ("[web] login") keeps it.
const clean = (s) => plain(s).replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

// An agent's terminal title when it says what the agent is doing, by the shipped agents
// list's rule: not a path, its own address, its program's name, or anything with an @.
// "" otherwise.
export function tellingTitle(agent) {
  const live = clean(agent?.title);
  // clean() would strip a path's leading ~ or /: test the title with only its status glyph gone.
  const path = /^[~/]|^[A-Za-z]:\\/.test((agent?.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== agent.address && live !== agent.program?.name && !path && !live.includes("@") && live.toLowerCase() !== agent.program?.key;
  return telling ? live : "";
}

// A card's first line: the repo the space is in. Outside a repo, Herdr's own name for the
// space (its folder, "~" at home), or the folder once someone typed a name: that name is the title.
export function cardHead({ space, repo, folder }) {
  return plain(repo ?? ((space.named && base(folder)) || space.name));
}

// The letter on a card's avatar: the first letter or digit of its first line, so ".config"
// is a C, not a dot. A name with neither ("~") keeps its first character.
export function avatarLetter(head) {
  return (head.match(/[\p{L}\p{N}]/u)?.[0] ?? [...head][0] ?? "?").toUpperCase();
}

// What a card says its space is about, first match wins: the name someone typed (the
// space's, else a tab's, the shown one first), what its most recently active agent says
// it is doing, its branch made readable, its folder.
// A tab the + menu named was not typed: the menu names a new agent's tab after its program.
// That is a tab named after an agent in it, as in the agents list, and a tab named as the
// menu names one, which holds once its agent is gone and before it first reports.
// `agents`: the space's own. `branch`: null outside a repo and on a detached head.
// `menuNames`: the names the + menu gives, null until main.js has learned them.
export function cardTitle({ space, agents, branch, folder, menuNames }) {
  if (space.named && plain(space.name)) return plain(space.name);
  const typed = (tab) => tab.named && plain(tab.name) && !menuNames?.has(tab.name) && !agents.some((a) => a.tab === tab.id && a.program?.name === tab.name);
  const tabs = (space.tabs ?? []).filter(typed);
  const tab = tabs.find((t) => t.active) ?? tabs[0];
  if (tab) return plain(tab.name);
  const recent = agents.reduce((a, b) => (a && a.seq >= b.seq ? a : b), null);
  return tellingTitle(recent) || plain(branch ? readableBranch(branch) : base(folder) || space.name);
}

// Each part on its own line. `context`: the card's context reading in words, when it shows one.
export function cardTooltip({ title, branch, folder, context }) {
  return [plain(title), plain(branch), plainPath(folder), context].filter(Boolean).join("\n");
}

// A length of time in its largest whole unit, or null under a minute.
function span(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return null;
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// How long ago a space last changed.
export const age = (ms) => span(ms) ?? "just now";

// How long an agent has been working. Under a minute it says so, as the agents list does:
// counting seconds would redraw the window every second.
export const elapsed = (ms) => span(ms) ?? "<1m";

const times = (space, field) => (space.tabs ?? []).map((tab) => tab[field]).filter(Number.isFinite);

// A card's state slot: the space's most urgent status, and the time that goes with it.
// Working: since the tab that has worked longest began. Idle, or no agent: since the last
// change in any tab. `text` is null when blocked or done, and when Herdr has no time to give
// (nothing changed since the app started).
export function cardState({ space, now }) {
  const status = space.status ?? "idle";
  if (status === "working") {
    const since = times(space, "working_since");
    return { status, text: since.length ? elapsed(now - Math.min(...since)) : null };
  }
  if (status !== "idle") return { status, text: null };
  const changed = times(space, "changed_at");
  return { status, text: changed.length ? age(now - Math.max(...changed)) : null };
}

// The fullest context reading among a space's agents, or null when none has one.
// `readings`: address -> reading (context.js `parseFeed`).
export function highestContext(agents, readings) {
  return agents.map((a) => readings.get(a.address)).filter(Boolean).reduce((top, r) => (top && top.percent >= r.percent ? top : r), null);
}

// The programs a space's agents run, each once, for the icons on its card.
export function agentPrograms(agents) {
  return [...new Map(agents.filter((a) => a.program?.icon).map((a) => [a.program.key, a.program])).values()];
}

// What a place knows of its git, as main.js keeps it per place:
//   undefined  not looked at yet
//   null       git's own word: the place is in no repo
//   false      looked at, and git has never answered (a folder that is gone, a bare repo,
//              a machine that is away)
//   an object  its repo (`gitInfo`)
// `afterLook` is that knowledge after one more look. `found`: what the look learned, a
// repo's info or null; undefined when it could not ask. A look that could not ask takes
// nothing back: the place keeps what git said before, so its space stays where it is.
export function afterLook(known, found) {
  if (found !== undefined) return found;
  return known === undefined ? false : known;
}

// What the order needs to know of a space's place. `git`: what the place knows (above).
// outside: in no repo by git's own word, or with no folder to be in a repo. pending: not
// looked at yet. A place git never answered for is neither: its space stays among the
// repos, and a place git can never read does not hold the others back for good.
export function standing({ folder, git }) {
  if (!folder) return { outside: true, pending: false };
  return { outside: git === null, pending: git === undefined };
}

// A place's checkout from the two ref reads, each a finished run ({ code, stdout, stderr })
// of `git rev-parse --path-format=absolute`: `top` with --show-toplevel, `common` with
// --git-common-dir. null on git's own "not a git repository"; undefined when git failed
// for any other reason, which is asked again rather than believed.
export function checkout(top, common) {
  const failed = [top, common].find((run) => run.code !== 0);
  if (failed) return /not a git repository/i.test(failed.stderr) ? null : undefined;
  // One line each: a folder's own name may hold a line break.
  const line = (run) => run.stdout.replace(/\n$/, "");
  return { top: line(top), repo: line(common) };
}

// A place's repo as its card draws it. `top`, `repo`: its `checkout`. `branch`: the run of
// `git symbolic-ref -q HEAD`, which fails on a detached head. `counts`: the run of
// `git rev-list --left-right --count HEAD...@{upstream}`, which fails without an upstream.
// The repo's own .git folder names it, and with its machine tells it from every other; a
// worktree's top is not the folder that .git is in.
export function gitInfo({ machine, top, repo, branch, counts, dirty }) {
  const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
  const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
  return {
    name: plain(name),
    branch: branch.code === 0 ? plain(branch.stdout.replace(/^refs\/heads\//, "")) : null,
    ahead,
    behind,
    dirty,
    repo: JSON.stringify([machine, repo]),
    linked: repo !== `${top}/.git`,
  };
}

// Whether a place has uncommitted changes. `was`: the mark it showed. `status`: the run of
// `git status --porcelain`, null when it could not finish. Only a status that ran can say;
// any other leaves the mark as it was, so a slow worktree's mark does not come and go.
export const dirtyAfter = (was, status) => (status?.code === 0 ? status.stdout !== "" : was);

// The spaces in the order the sidebar draws them: machine by machine as Herdr keeps them,
// each worktree space under its main checkout's (`nested` on its row), and the spaces
// outside any repo after the machine's repos.
// `rows`: one per space, in the real order: { w: the space, g: its place's git or null,
// outside, pending: its `standing` }. While a space is pending nothing on its machine goes
// last: guessing would shuffle spaces as the answers arrive.
export function visualOrder(rows) {
  const mains = new Set(rows.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
  const nested = (r) => Boolean(r.g?.linked) && mains.has(r.g.repo);
  const machine = (r) => r.w.machine ?? null;
  const out = [];
  const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
  for (const m of new Set(rows.map(machine))) {
    const mine = rows.filter((r) => machine(r) === m);
    const known = mine.every((r) => !r.pending);
    const last = (r) => known && r.outside;
    for (const r of mine) {
      if (nested(r) || last(r)) continue;
      out.push({ ...r, nested: false });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      for (const k of rows) if (nested(k) && k.g.repo === r.g.repo) out.push({ ...k, nested: true });
    }
    for (const r of mine.filter(last)) out.push({ ...r, nested: false });
  }
  return out;
}

// The `space.move` calls that turn the real order into the drawn one, none when they
// already match. `order`, `target`: the same space ids; one only `target` has is not a
// space to move. Each index is 1-based and counts the moves before it as done.
export function plannedMoves(order, target) {
  const now = [...order];
  const moves = [];
  target.filter((id) => now.includes(id)).forEach((id, i) => {
    const from = now.indexOf(id);
    if (from === i) return;
    moves.push({ id, index: i + 1 });
    now.splice(i, 0, now.splice(from, 1)[0]);
  });
  return moves;
}
