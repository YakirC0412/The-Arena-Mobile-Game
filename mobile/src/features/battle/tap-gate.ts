// One physical tap can reach a web button as several events: touchstart, pointerdown, mousedown, and later
// a click. The skip button listens to all of them (iPhone Safari does not always deliver the same ones) and
// uses this gate so a single tap skips exactly once. Pure, so it can be tested under Node.
export function createTapGate({ dedupeMs = 300, clickAfterDownMs = 1500 } = {}) {
  let lastDown = -Infinity;
  let lastClick = -Infinity;
  return {
    // touchstart / pointerdown / mousedown: the first of a burst counts.
    down(now: number): boolean {
      if (now - lastDown < dedupeMs) return false;
      lastDown = now;
      return true;
    },
    // click: only counts when no "down" event came first (the click that follows a counted press is ignored).
    click(now: number): boolean {
      if (now - lastDown < clickAfterDownMs || now - lastClick < dedupeMs) return false;
      lastClick = now;
      return true;
    },
  };
}
