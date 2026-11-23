// Pure decisions for the context readout: no herdr or gpui-kit import, so Node can test them.
//
// The feed is one JSON file per Herdr terminal, written by ~/.claude/statusline.sh. Any local
// process can write that folder, so a file counts only when it has exactly the expected shape.

const PLAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The feed file of a terminal on this machine, or null when its address is not a plain id
 *  (a terminal on another machine, `vps/t7`, has no feed here). */
export function feedPath(home, address) {
  return typeof address === "string" && PLAIN_ID.test(address) ? `${home}/.cache/herdr-context/${address}.json` : null;
}

const amount = (n, min) => (Number.isFinite(n) && n >= min ? n : null);

/** A feed file's text as `{ percent, tokens, window }`, or null when there is nothing to show:
 *  the file is missing or malformed, its percentage is not a number from 0 to 100, or it was
 *  not written between its terminal's start (`startedMs`) and `nowMs`. A feed older than its
 *  terminal belongs to an earlier terminal that had the same address. */
export function parseFeed(text, startedMs, nowMs) {
  let feed;
  try { feed = JSON.parse(text); } catch { return null; }
  if (!feed) return null;
  const { used_percentage: used, written_at: written } = feed;
  if (!Number.isFinite(used) || used < 0 || used > 100) return null;
  if (![written, startedMs, nowMs].every(Number.isFinite) || written < startedMs || written > nowMs) return null;
  return { percent: Math.round(used), tokens: amount(feed.tokens, 0), window: amount(feed.window, 1) };
}

/** The warning color of a percentage, or null below the first threshold, where the caller uses
 *  the theme's dim. Thresholds and colors are the status line's (`sev_color`, a colorblind-safe
 *  ramp); only its blue for the quiet band is left out, so a list of readouts stays quiet until
 *  one needs attention. */
export function bandColor(percent) {
  return percent >= 90 ? "#ff5f5f" : percent >= 70 ? "#ffaf00" : null;
}

function compact(n) {
  if (n < 1000) return String(Math.round(n));
  if (n < 999_500) return `${Math.round(n / 1000)}k`;
  return `${Number((n / 1_000_000).toFixed(1))}M`;
}

/** The readout's tooltip. */
export function describe({ percent, tokens, window }) {
  const head = `Context ${percent}%`;
  return tokens == null || window == null ? head : `${head} - ${compact(tokens)} of ${compact(window)} tokens`;
}
