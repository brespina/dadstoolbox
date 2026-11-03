// The speed at each second of a test, for the chart after it. Pure: no page.
import { rightWordCharacters, type TypingTest } from './typing';

/** The speed so far, `second` seconds after the first key press. */
export interface Sample {
  second: number;
  /** As in the score: words typed right, with the spaces after them, as words of 5. */
  wpm: number;
  /** As in the score: every character key pressed, as words of 5. */
  raw: number;
}

/**
 * One sample for each second of a finished test, counted from the first key press, and
 * a last one where the test ended when that falls between seconds. Each sample is the
 * speed over the whole test so far, so the last one matches the score.
 */
export function samples(test: TypingTest): Sample[] {
  if (test.startedAt === undefined) return [];
  const startedAt = test.startedAt;
  const endedAt = test.endedAt ?? test.presses.at(-1)?.at ?? startedAt;
  const total = (endedAt - startedAt) / 1000;

  const result: Sample[] = [];
  for (let second = 1; second - 1 < total; second++) {
    const last = second >= total;
    const at = last ? total : second;
    // The last sample reads the exact end, so no key press falls out by rounding.
    const until = last ? endedAt : startedAt + second * 1000;
    const perMinute = (characters: number) => Math.round(characters / 5 / (at / 60));
    result.push({
      second: at,
      wpm: perMinute(rightWordCharacters(test, until)),
      raw: perMinute(test.presses.filter((p) => p.at <= until).length),
    });
  }
  return result;
}
