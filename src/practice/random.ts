// Random numbers for Practice Tools. A seed gives the same numbers every time, so a page
// test can ask for the same words or targets with `?seed=` in the page's address.

/** A source of random numbers from 0 (included) to 1 (not included), like Math.random. */
export type Random = () => number;

/** The same numbers for the same seed (a small, fast generator, mulberry32). */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The page's random source: seeded from `?seed=<number>` in the page's address when there
 * is one (for page tests), otherwise different every visit.
 */
export function pageRandom(search: string): Random {
  const seed = Number.parseInt(new URLSearchParams(search).get('seed') ?? '', 10);
  return Number.isFinite(seed) ? seededRandom(seed) : Math.random;
}
