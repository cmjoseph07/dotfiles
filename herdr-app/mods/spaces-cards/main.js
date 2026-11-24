// Workspace spaces as cards: the repo its first terminal is in now behind a stable
// colored avatar and its most urgent state, what the space is about, then its branch,
// ahead/behind and uncommitted changes beside its agents and their fullest context.
// Worktrees sit under their checkout and spaces outside any repo come last, grouped by
// machine when more than one is known. Click to switch, right-click for its menu, drag to reorder.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, machines, panes, agents, terminals, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, layout, home, readTextFile, knownAgents, checking } from "herdr";
import { afterLook, agentPrograms, avatarLetter, cardHead, cardState, cardTitle, cardTooltip, checkout, dirtyAfter, gitInfo, highestContext, plannedMoves, standing, visualOrder } from "./model.js";
import { Looks } from "./looks.js";
import { bandColor, describe, feedPath, parseFeed } from "./context.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const RAIL_CELL = 32;
const AVATAR = 18;
// A title takes two lines at most: this build has no line clamp, so the rest is cut off.
const TITLE_LINE = 18;
const railCell = (el) => h_flex().flex_none().justify_center().child(el);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;
// Places looked at together (two git runs each at a time). All at once, a few hundred
// spaces run out of the app's open files (256 when started from the Dock on macOS) or
// past a machine core's 16 running execs, and those spaces wait for FALLBACK.
const AT_ONCE = 5;
// The dirty marks are read apart from the refs, fewer at a time and each for no longer than
// DIRTY_LIMIT: it is the one read that scans a whole worktree, and no place's repo, branch
// or nesting waits for it. With the refs that is 12 runs at most, under a core's 16.
const DIRTY_AT_ONCE = 2;
const DIRTY_LIMIT = 10000;

// Git as this mod asks it: never in a bare repo it was not pointed at. A folder laid out as
// one can sit inside any clone, and reading its status would run the programs its own
// config names (filters). A worktree of a bare repo is found through its .git file and
// still answers; a place inside a bare repo is one git does not answer for, as before.
const git = (args, options) => exec("git", ["-c", "safe.bareRepository=explicit", ...args], options);

// Every run, finished: a place isn't done while one of its runs still holds a slot.
async function finished(...runs) {
  const done = await Promise.allSettled(runs);
  const failed = done.find((d) => d.status === "rejected");
  if (failed) throw failed.reason;
  return done.map((d) => d.value);
}

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

// An agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Spaces extends View {
  init(_props, cx) {
    // where() -> what the place knows of its git (model.js `afterLook`): its repo's info
    // { name, branch (null: detached), ahead, behind, dirty, repo, linked }, null: git says
    // no repo, false: git never answered. Absent: not looked at yet.
    this.git = {};
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s whose last look could not ask git (a machine away): asked again
    this.refs = new Looks(AT_ONCE, (key, cx) => this.check(key, cx));
    this.marks = new Looks(DIRTY_AT_ONCE, (key) => this.checkDirty(key));
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Map(); // local repos' pending folder watches
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.scroll = ScrollHandle.new(); // the list's position: the active space is brought into view through it
    this.activeAt = -1; // the active space's place among the list's children (headers and rows), -1 when not drawn
    this.machines = [];
    try {
      this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
      if (!this.reconnecting || typeof this.reconnecting !== "object" || Array.isArray(this.reconnecting)) this.reconnecting = {};
      for (const state of Object.values(this.reconnecting)) state.busy = false;
    } catch { this.reconnecting = {}; }
    try { this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]")); } catch { this.folded = new Set(); }
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // Refresh only when the refs could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
    // The cards' ages and elapsed times count in minutes: redrawn when one reads differently.
    cx.timer.every(30000, (cx) => { if (this.times() !== this.drawnTimes) cx.notify(); });
    // Each Claude Code agent's context reading, by address.
    this.context = new Map();
    cx.timer.every(5000, (cx) => this.readContext(cx));
    this.readContext(cx);
    this.menuNames = null; // the names the + menu gives its tabs, once learned (see `learnMenuNames`)
    this.namesAsked = 0;
  }

  // The times the cards show now, as one string. The rail shows none.
  times() {
    const now = Date.now();
    return narrow() ? "" : spaces().map((w) => cardState({ space: w, now }).text ?? "").join("|");
  }

  // Rereads the feed of every Claude Code agent; redraws only when a reading changed.
  // One read at a time: a slow one is not overtaken by the next, whose older answer
  // would then land last.
  readContext(cx) {
    if (this.readingContext) return;
    const claude = agents().filter((a) => a.app === "claude-code");
    if (!claude.length && !this.context.size) return;
    const started = new Map(terminals().map((k) => [k.address, k.created_ms]));
    this.readingContext = true;
    cx.spawn(async (cx) => {
      try {
        const readings = await Promise.all(claude.map(async (a) => {
          const path = feedPath(home(), a.address);
          const text = path ? await readTextFile(path).catch(() => null) : null;
          return [a.address, parseFeed(text, started.get(a.address), Date.now())];
        }));
        const next = new Map(readings.filter(([, reading]) => reading));
        if (JSON.stringify([...next]) === JSON.stringify([...this.context])) return;
        this.context = next;
        cx.notify();
      } finally {
        this.readingContext = false;
      }
    });
  }

  // The names the + menu gives the tabs it makes: it names a new agent's tab after its
  // program, so a tab named so was typed by nobody (model.js `cardTitle`). Asked until
  // answered, as often as FALLBACK: the answer comes from a login shell.
  learnMenuNames(now, cx) {
    this.namesAsked = now;
    if (checking()) return;
    cx.spawn(async (cx) => {
      try {
        this.menuNames = new Set((await knownAgents()).map((a) => a.name));
        cx.notify();
      } catch {}
    });
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    if (!this.menuNames && now - this.namesAsked > FALLBACK) this.learnMenuNames(now, cx);
    const due = this.due(now, sp, panes());
    if (due.size) this.refs.ask(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    for (const k of Object.keys(this.git)) if (!keys.has(k)) {
      delete this.git[k];
      delete this.checked[k];
      this.unsure.delete(k);
    }
    const repos = new Set(Object.values(this.git).filter(Boolean).map((g) => g.repo));
    for (const [repo, pending] of this.watching) if (!repos.has(JSON.stringify([null, repo]))) {
      this.watching.delete(repo);
      pending.cancel();
    }
    // Not looked at yet. A look that is still running counts as begun: it is not asked for twice.
    const due = new Set([...keys].filter((k) => !(k in this.checked)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  // Redraws only when the machines read differently: this runs every 15s.
  refreshMachines(cx) {
    if (checking()) return;
    cx.spawn(async cx => {
      let now = this.machines;
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) now = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      if (JSON.stringify(now) === JSON.stringify(this.machines)) return;
      this.machines = now;
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One place's git from its refs: its repo, branch, ahead/behind. Its dirty mark follows.
  // Says whether the place now knows something else.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    const before = JSON.stringify(this.git[key]);
    this.checked[key] = Date.now();
    let tree, found;
    try {
      // Ref-only reads avoid scanning the worktree or waking its index watch.
      // Two reads: a folder name may itself contain a newline.
      tree = checkout(...await finished(
        git(["rev-parse", "--path-format=absolute", "--show-toplevel"], { cwd, on }),
        git(["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on }),
      ));
      found = tree;
      if (tree) {
        const [branch, counts] = await finished(
          git(["symbolic-ref", "-q", "HEAD"], { cwd, on }),
          git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on }),
        );
        // The mark the place showed stays until its own read says otherwise.
        found = gitInfo({ machine: on, ...tree, branch, counts, dirty: Boolean(this.git[key]?.dirty) });
      }
    } catch {
      // Couldn't ask (the machine is away, the folder is gone): nothing found, asked again.
      found = undefined;
    }
    this.git[key] = afterLook(this.git[key], found);
    if (found === undefined) this.unsure.add(key);
    else this.unsure.delete(key);
    if (found) {
      if (!on) this.watch(tree.repo, cx);
      this.marks.ask([key], cx);
    }
    return JSON.stringify(this.git[key]) !== before;
  }

  // One place's dirty mark: the one read of its worktree, as the shipped worktree dialog
  // asks it, without the index refresh a status would otherwise write (that write would
  // wake this repo's watch). When it can't finish in time the mark stays as it was.
  // Says whether the mark changed.
  async checkDirty(key) {
    const [on, cwd] = JSON.parse(key);
    const status = await git(["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain"], { cwd, on, timeout: DIRTY_LIMIT }).catch(() => null);
    const g = this.git[key];
    if (!g) return false;
    const was = g.dirty;
    g.dirty = dirtyAfter(was, status);
    return g.dirty !== was;
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    const pending = watchFolder(repo);
    this.watching.set(repo, pending);
    cx.spawn(async (cx) => {
      let current = pending;
      try {
        for (;;) {
          await current;
          if (this.watching.get(repo) !== current) return;
          const mine = JSON.stringify([null, repo]);
          const keys = Object.keys(this.git).filter((k) => this.git[k]?.repo === mine);
          if (!keys.length) break;
          this.refs.ask(keys, cx);
          current = watchFolder(repo);
          this.watching.set(repo, current);
        }
      } catch {}
      if (this.watching.get(repo) === current) this.watching.delete(repo);
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in the order drawn (model.js `visualOrder`), and the real order made to match
  // it: a space's number (ctrl-1..9, the rail) is then its place on screen.
  ordered() {
    const sp = spaces(), ps = panes(), ag = agents();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const out = visualOrder(sp.map((w, i) => {
      const key = where(w, ps), folder = place(w, ps);
      const known = standing({ folder, git: this.git[key] });
      return { w, i, g: this.git[key] || null, ...known, folder, agents: ag.filter((a) => a.space === w.id) };
    }));
    // An attempted write can lose a sync conflict: allow the echo to settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const moves = plannedMoves(order, target);
    const key = JSON.stringify([order, target, machines()]);
    if (!moves.length) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const machine = new Map(sp.map(w => [w.id, w.machine ?? null]));
      this.ordering = { key, at: Date.now(), machines: [...new Set(moves.map(move => machine.get(move.id)))] };
      for (const move of moves) run("space.move", move);
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    const draw = (r) => (collapsed ? this.compact(r, t) : this.card(r, t));
    // Where the active space's row lands among the children this returns: the list scrolls by its direct
    // children, and machine headers, login notes and loading rows count too.
    this.activeAt = -1;
    let before = 0;
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => h_flex().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).items_center().when(collapsed, el => el.justify_center()).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) {
      if (loading(null) && !rows.length) return [loadingRow(null)];
      this.activeAt = rows.findIndex(r => r.w.active);
      return rows.map(draw);
    }
    const machineNames = [null, ...remote];
    return machineNames.flatMap((m) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const login = machine?.state === "needs_login" ? `hc machine login ${m}` : null;
      const folded = this.folded.has(m);
      const icon = svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none();
      const badge = div().absolute().right(-3).bottom(-2).size(6).rounded(3).border_1().border_color(t.chrome).bg(connected ? t.ansi2 : t.dim);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(26).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .when(collapsed, el => el.mt(4).w(RAIL_CELL).justify_center().rounded(6).tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? "connected" : (machine?.state ?? "asleep").replace(/_/g, " ")}` : "This computer"))
        .cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          if (collapsed && login) { run("app.settings", { section: "machines" }); return; }
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .when(machine?.keeps_running_after_logout === false, el => el.child(div().id(`machine-logout-${m}`)
          .flex_none().text_color(t.blocked).tooltip("Agents stop when you disconnect. Click for the fix.")
          .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "machine-add", kind: "dialog", width: 560 }); }).child("⚠")))
        .when(!collapsed, el => el.child(icon))
        .when(collapsed, el => el.child(div().relative().flex_none().child(icon).when(Boolean(m), el => el.child(badge))))
        .when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? "This computer"))
          .when(!connected && !rebuilt && !login, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
            .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect"))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => run("space.new", { machine: m ?? "" }))
        .when(collapsed, el => el.w(RAIL_CELL).rounded(6).justify_center().tooltip(`New space on ${m ?? "this computer"}`)
          .child(h_flex().size(18).rounded(5).border_1().border_color(t.dim).items_center().justify_center()
            .child(svg("mods/workspace-chrome/plus.svg").size(10))))
        .when(!collapsed, el => el.child(svg("mods/workspace-chrome/plus.svg").size(12)).child("New space there"));
      if (!collapsed && rebuilt) { before += 1; return [head]; }
      const cell = collapsed ? railCell : (el) => el;
      const guidance = !collapsed && login ? [v_flex().px(8).pb(6).gap(3).flex_none()
        .child(div().text_size(11).text_color(t.blocked).child("needs a login: run"))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1().min_w(0).truncate().tooltip(login).text_size(11).text_color(t.muted).child(login))
          .child(div().id(`machine-login-copy-${m}`).flex_none().px(5).py(2).rounded(4)
            .text_size(11).text_color(t.foreground).bg(t.raised).cursor_pointer().hover(s => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); this.copiedLogin = login; cx.notify(); })
            .child(this.copiedLogin === login ? "Copied" : "Copy")))] : [];
      const items = [cell(head), ...guidance, ...(folded ? [] : mine.length ? mine.map(draw) : [loading(m) ? loadingRow(m) : cell(empty)])];
      const first = folded ? -1 : mine.findIndex(r => r.w.active);
      if (first >= 0) this.activeAt = before + 1 + guidance.length + first;
      before += items.length;
      return items;
    });
  }

  // Line 1's right side: the space's most urgent state, drawn as the agents list draws it.
  stateSlot({ status, text }, t) {
    if (status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    if (status === "done") return h_flex().flex_none().gap(5).items_center().text_size(11).text_color(t.done)
      .child(div().size(7).flex_none().rounded(4).bg(t.done))
      .child("Done");
    const time = text && div().text_size(11).text_color(t.dim).child(text);
    if (status === "working") return h_flex().flex_none().gap(5).items_center()
      .child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900))
      .when(Boolean(time), (el) => el.child(time));
    return time;
  }

  // Line 3: where the space is in git, then its agents and their fullest context. A long
  // branch gives way in its middle, so both ends stay readable; master and main are shown
  // too, or the line would be empty.
  detailLine(g, programs, reading, t) {
    return h_flex()
      .gap(6)
      .items_center()
      .text_size(11.5)
      .text_color(t.dim)
      .child(h_flex().flex_1().min_w(0).gap(5).items_center().when(Boolean(g), (el) => el
        .child(div().min_w(0).truncate().text_ellipsis_middle().child(g.branch ?? "detached"))
        .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
        .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`)))
        .when(g.dirty, (el) => el.child(div().flex_none().text_size(8).text_color(t.ansi3).child("\u25cf")))))
      .children(programs.map((p) => icon(p, 12, t.muted)))
      .when(Boolean(reading), (el) => el.child(div().flex_none().text_size(11).text_color(bandColor(reading.percent) ?? t.dim).child(`${reading.percent}%`)));
  }

  card({ w, i, g, nested, folder, agents: mine }, t) {
    const on = w.active;
    const head = cardHead({ space: w, repo: g?.name ?? null, folder });
    const title = cardTitle({ space: w, agents: mine, branch: g?.branch ?? null, folder, menuNames: this.menuNames });
    const state = this.stateSlot(cardState({ space: w, now: Date.now() }), t);
    const programs = agentPrograms(mine);
    const reading = highestContext(mine, this.context);
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .py(7)
      .gap(2)
      .flex_none()
      .rounded(8)
      .when(nested, (el) => el.ml(16))
      .tooltip(cardTooltip({ title, branch: g?.branch, folder, context: reading && describe(reading) }))
      .when(on, (el) => el.bg(t.raised))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, line => line.bottom(0))
          .when(fromIndex > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex()
          .gap(8)
          .items_center()
          .when(nested, el => el.child(h_flex().size(AVATAR).flex_none().items_center().justify_center().child(svg("mods/workspace-chrome/branch.svg").size(13).text_color(t.dim))))
          .when(!nested, el => el.child(h_flex().size(AVATAR).flex_none().rounded(5).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child(avatarLetter(head))))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(head))
          .when(Boolean(state), (el) => el.child(state)),
      )
      // A space with nothing to say beyond its folder's name says it once, on line 1.
      .when(title !== head, (el) => el.child(div().max_h(2 * TITLE_LINE).overflow_hidden().line_height(`${TITLE_LINE}px`).font_semibold().text_color(t.foreground).child(title)))
      .when(Boolean(g) || programs.length > 0 || Boolean(reading), (el) => el.child(this.detailLine(g, programs, reading, t)));
  }

  compact({ w, i }, t) {
    return railCell(h_flex()
      .id(`space-${w.id}`)
      .relative()
      .w(RAIL_CELL)
      .h(26)
      .rounded(6)
      .justify_center()
      .items_center()
      .when(w.active, (el) => el.bg(t.selected))
      .when(!w.active, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => run("space.select", { id: w.id }))
      .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
      .child(div().absolute().right(5).text_color(tone(t, w.status)).child(glyph(w.status))));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    this.drawnTimes = this.times();
    const list = this.grouped(t, collapsed);
    // Bring the active space into view when it, or its place in the list, changes; a row already in view stays put.
    const active = sp.find(p => p.active)?.id;
    if (active !== this.revealed || this.activeAt !== this.revealedAt) {
      this.revealed = active;
      this.revealedAt = this.activeAt;
      if (this.activeAt >= 0) this.scroll.scroll_to_item(this.activeAt);
    }
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, el => el.pl(0).pr(0).justify_center())
        .when(!collapsed, el => el.child("Spaces"))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new")).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(14).overflow_y_scrollbar().mode("always").track_scroll(this.scroll)
        // A block above (another mod's) growing, or the window resizing, shrinks this list and can push the active space out.
        .on_size_change((_size, cx) => { if (this.activeAt >= 0) { this.scroll.scroll_to_item(this.activeAt); cx.notify(); } })
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
        .children(list));
  }
}
