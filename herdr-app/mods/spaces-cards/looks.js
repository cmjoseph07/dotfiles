// Places looked at a few at a time. No herdr or gpui-kit import, so Node can test it.

// One pass at a time, each place once however often it was asked for before its look
// began; a place asked for again while it is looked at gets another look in the next pass.
// A redraw follows each look that changed what is drawn, so no place waits for the slowest
// one looked at beside it.
export class Looks {
  // `look`: async (place, cx) => whether it changed what is drawn.
  constructor(atOnce, look) {
    this.atOnce = atOnce;
    this.look = look;
    this.asked = new Set();
    this.running = false;
  }

  // `cx`: the caller's, used to start the pass; each look gets the pass's own.
  ask(places, cx) {
    for (const place of places) this.asked.add(place);
    if (this.running) return;
    this.running = true;
    cx.spawn(async (cx) => {
      while (this.asked.size) {
        const places = [...this.asked];
        this.asked.clear();
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(this.atOnce, places.length) }, async () => {
          while (next < places.length) {
            const place = places[next++];
            // A look that throws is that place's loss alone: the others still get theirs.
            const changed = await this.look(place, cx).catch((error) => console.log(`look at ${place} failed: ${error}`));
            if (changed) cx.notify();
          }
        }));
      }
      this.running = false;
    });
  }
}
