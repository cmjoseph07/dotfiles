import { test } from "node:test";
import assert from "node:assert/strict";
import { Looks } from "./looks.js";

// What the queue needs of the app's context: it starts a task, after the caller's own
// turn, and counts the redraws.
const context = () => {
  const cx = { redraws: 0, tasks: [], spawn: (task) => cx.tasks.push(Promise.resolve().then(() => task(cx))), notify: () => { cx.redraws += 1; } };
  return cx;
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
// A look that waits until the test lets it end.
const gate = () => {
  let open;
  const wait = new Promise((resolve) => { open = resolve; });
  return { wait, open };
};
const settled = (cx) => Promise.all(cx.tasks);

test("Looks looks at every place asked for, once each", async () => {
  const seen = [];
  const looks = new Looks(2, async (place) => { seen.push(place); return false; });
  const cx = context();
  looks.ask(["a", "b", "c"], cx);
  looks.ask(["b"], cx);
  await settled(cx);
  assert.deepEqual(seen.sort(), ["a", "b", "c"]);
});

test("Looks runs no more looks at once than it was given", async () => {
  let now = 0, most = 0;
  const gates = Object.fromEntries(["a", "b", "c", "d", "e"].map((place) => [place, gate()]));
  const looks = new Looks(2, async (place) => {
    most = Math.max(most, ++now);
    await gates[place].wait;
    now -= 1;
    return false;
  });
  const cx = context();
  looks.ask(Object.keys(gates), cx);
  for (const place of Object.keys(gates)) {
    await turn();
    gates[place].open();
  }
  await settled(cx);
  assert.equal(most, 2);
});

test("Looks gives a place asked for again during its look another look", async () => {
  const seen = [];
  const first = gate();
  const looks = new Looks(2, async (place) => {
    seen.push(place);
    if (seen.length === 1) await first.wait;
    return false;
  });
  const cx = context();
  looks.ask(["a"], cx);
  await turn();
  looks.ask(["a"], cx);
  first.open();
  await settled(cx);
  assert.deepEqual(seen, ["a", "a"]);
  assert.equal(cx.tasks.length, 1, "the second ask joined the pass that was running");
});

test("Looks redraws after each look that changed what is drawn, and only then", async () => {
  const looks = new Looks(2, async (place) => place !== "same");
  const cx = context();
  looks.ask(["new", "same", "moved"], cx);
  await settled(cx);
  assert.equal(cx.redraws, 2);
});

test("Looks redraws for a quick place without waiting for a slow one beside it", async () => {
  const slow = gate();
  const looks = new Looks(2, async (place) => {
    if (place === "slow") await slow.wait;
    return true;
  });
  const cx = context();
  looks.ask(["slow", "quick"], cx);
  await turn();
  assert.equal(cx.redraws, 1);
  slow.open();
  await settled(cx);
  assert.equal(cx.redraws, 2);
});

test("Looks keeps going when a look throws: the other places get theirs, and so does a later ask", async (t) => {
  t.mock.method(console, "log", () => {});
  const seen = [];
  const looks = new Looks(1, async (place) => {
    if (place === "broken") throw new Error("no");
    seen.push(place);
    return true;
  });
  const cx = context();
  looks.ask(["broken", "a"], cx);
  await settled(cx);
  looks.ask(["b"], cx);
  await settled(cx);
  assert.deepEqual(seen, ["a", "b"]);
  assert.equal(cx.redraws, 2);
});
