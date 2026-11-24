import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { bandColor, describe, feedPath, parseFeed } from "./context.js";

const STARTED = 1_000_000;
const NOW = 2_000_000;
const feed = (fields) => JSON.stringify({ used_percentage: 42, tokens: 84_000, window: 200_000, model: "Fable 5.2", written_at: 1_500_000, ...fields });

test("bandColor warns at the status line's thresholds, in its colors", () => {
  assert.equal(bandColor(0), null);
  assert.equal(bandColor(69), null);
  assert.equal(bandColor(70), "#ffaf00");
  assert.equal(bandColor(89), "#ffaf00");
  assert.equal(bandColor(90), "#ff5f5f");
  assert.equal(bandColor(100), "#ff5f5f");
});

test("parseFeed reads the percentage, tokens and window of a fresh feed", () => {
  assert.deepEqual(parseFeed(feed(), STARTED, NOW), { percent: 42, tokens: 84_000, window: 200_000 });
});

test("parseFeed rounds the percentage as the status line does, so both land in one band", () => {
  assert.equal(parseFeed(feed({ used_percentage: 89.5 }), STARTED, NOW).percent, 90);
  assert.equal(parseFeed(feed({ used_percentage: 69.4 }), STARTED, NOW).percent, 69);
});

test("parseFeed accepts the edges of the range", () => {
  assert.equal(parseFeed(feed({ used_percentage: 0 }), STARTED, NOW).percent, 0);
  assert.equal(parseFeed(feed({ used_percentage: 100 }), STARTED, NOW).percent, 100);
});

test("parseFeed shows nothing for a missing feed", () => {
  assert.equal(parseFeed(null, STARTED, NOW), null);
  assert.equal(parseFeed(undefined, STARTED, NOW), null);
  assert.equal(parseFeed("", STARTED, NOW), null);
});

test("parseFeed shows nothing for a malformed feed", () => {
  assert.equal(parseFeed("{", STARTED, NOW), null);
  assert.equal(parseFeed("not json", STARTED, NOW), null);
  assert.equal(parseFeed("null", STARTED, NOW), null);
  assert.equal(parseFeed("42", STARTED, NOW), null);
  assert.equal(parseFeed('"42"', STARTED, NOW), null);
  assert.equal(parseFeed("[42]", STARTED, NOW), null);
});

test("parseFeed shows nothing for a percentage that is not a number from 0 to 100", () => {
  assert.equal(parseFeed(feed({ used_percentage: null }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ used_percentage: "42" }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ used_percentage: true }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ used_percentage: -1 }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ used_percentage: 100.1 }), STARTED, NOW), null);
  assert.equal(parseFeed('{"used_percentage":1e400,"written_at":1500000}', STARTED, NOW), null);
});

test("parseFeed shows nothing for a feed written before its terminal started", () => {
  assert.equal(parseFeed(feed({ written_at: STARTED - 1 }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ written_at: STARTED }), STARTED, NOW).percent, 42);
});

test("parseFeed shows nothing for a feed dated in the future", () => {
  assert.equal(parseFeed(feed({ written_at: NOW + 1 }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ written_at: NOW }), STARTED, NOW).percent, 42);
});

test("parseFeed shows nothing when the write time or the terminal's start is unknown", () => {
  assert.equal(parseFeed(feed({ written_at: undefined }), STARTED, NOW), null);
  assert.equal(parseFeed(feed({ written_at: "1500000" }), STARTED, NOW), null);
  assert.equal(parseFeed(feed(), undefined, NOW), null);
  assert.equal(parseFeed(feed(), null, NOW), null);
  assert.equal(parseFeed(feed(), "1000000", NOW), null);
  assert.equal(parseFeed(feed(), NaN, NOW), null);
});

test("parseFeed shows nothing when the current time is unknown", () => {
  assert.equal(parseFeed(feed(), STARTED, undefined), null);
  assert.equal(parseFeed(feed(), STARTED, NaN), null);
  assert.equal(parseFeed(feed(), STARTED, "2000000"), null);
});

test("parseFeed keeps the percentage when tokens or window are unusable", () => {
  assert.deepEqual(parseFeed(feed({ tokens: null, window: null }), STARTED, NOW), { percent: 42, tokens: null, window: null });
  assert.deepEqual(parseFeed(feed({ tokens: -5, window: 0 }), STARTED, NOW), { percent: 42, tokens: null, window: null });
  assert.deepEqual(parseFeed(feed({ tokens: "84000", window: {} }), STARTED, NOW), { percent: 42, tokens: null, window: null });
});

test("parseFeed keeps the smallest usable tokens and window", () => {
  assert.deepEqual(parseFeed(feed({ tokens: 0, window: 1 }), STARTED, NOW), { percent: 42, tokens: 0, window: 1 });
});

test("feedPath names the feed file of a local terminal", () => {
  assert.equal(feedPath("/Users/me", "t4"), "/Users/me/.cache/herdr-context/t4.json");
  assert.equal(feedPath("/Users/me", "t1b"), "/Users/me/.cache/herdr-context/t1b.json");
  assert.equal(feedPath("/Users/me", "A_b-9"), "/Users/me/.cache/herdr-context/A_b-9.json");
  assert.equal(feedPath("/Users/me", "x".repeat(64)), `/Users/me/.cache/herdr-context/${"x".repeat(64)}.json`);
});

test("feedPath refuses an address that is not a plain id", () => {
  assert.equal(feedPath("/Users/me", "vps/t7"), null);
  assert.equal(feedPath("/Users/me", "../t4"), null);
  assert.equal(feedPath("/Users/me", ".."), null);
  assert.equal(feedPath("/Users/me", "t4.json"), null);
  assert.equal(feedPath("/Users/me", "t4\n"), null);
  assert.equal(feedPath("/Users/me", ""), null);
  assert.equal(feedPath("/Users/me", undefined), null);
  assert.equal(feedPath("/Users/me", 4), null);
  assert.equal(feedPath("/Users/me", "x".repeat(65)), null);
});

test("describe spells out the tokens and window when both are known", () => {
  assert.equal(describe({ percent: 15, tokens: 154_376, window: 1_000_000 }), "Context 15% - 154k of 1M tokens");
  assert.equal(describe({ percent: 42, tokens: 84_000, window: 200_000 }), "Context 42% - 84k of 200k tokens");
  assert.equal(describe({ percent: 1, tokens: 950, window: 1_500_000 }), "Context 1% - 950 of 1.5M tokens");
});

test("describe changes unit where the rounded number would", () => {
  assert.equal(describe({ percent: 1, tokens: 999, window: 1000 }), "Context 1% - 999 of 1k tokens");
  assert.equal(describe({ percent: 1, tokens: 1600, window: 999_499 }), "Context 1% - 2k of 999k tokens");
  assert.equal(describe({ percent: 1, tokens: 0, window: 999_500 }), "Context 1% - 0 of 1M tokens");
});

test("describe falls back to the percentage alone", () => {
  assert.equal(describe({ percent: 42, tokens: null, window: 200_000 }), "Context 42%");
  assert.equal(describe({ percent: 42, tokens: 84_000, window: null }), "Context 42%");
});

// The other side of the feed: what ~/.claude/statusline.sh writes must be what parseFeed reads.
const STATUS_LINE = join(homedir(), ".claude/statusline.sh");
const hasJq = spawnSync("jq", ["--version"]).status === 0;

test("the status line writes a feed parseFeed reads, and removes it when it cannot", { skip: !existsSync(STATUS_LINE) || !hasJq }, () => {
  const home = mkdtempSync(join(tmpdir(), "herdr-context-"));
  const run = (input) => spawnSync("bash", [STATUS_LINE], { input, env: { ...process.env, HOME: home, HC_TERMINAL_ID: "t9" } });
  const path = feedPath(home, "t9");
  try {
    const started = Date.now();
    run(JSON.stringify({
      model: { display_name: "Fable 5.2" },
      context_window: {
        used_percentage: 42.4,
        context_window_size: 200_000,
        current_usage: { input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 81_000, output_tokens: 500 },
      },
    }));
    assert.deepEqual(parseFeed(readFileSync(path, "utf8"), started, Date.now()), { percent: 42, tokens: 84_000, window: 200_000 });
    run('{"context_window":"not an object"}');
    assert.equal(existsSync(path), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// The same check as in spaces-cards/model.test.js: either suite alone catches a one-sided edit.
test("context.js is byte for byte the copy in spaces-cards", () => {
  const mine = readFileSync(new URL("./context.js", import.meta.url));
  const theirs = readFileSync(new URL("../spaces-cards/context.js", import.meta.url));
  assert.ok(mine.equals(theirs), "agents-context/context.js and spaces-cards/context.js differ: change both, they cannot import each other");
});
