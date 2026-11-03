import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../practice/random';
import { fewestKeys, placeKey } from './fewest';
import { lessonMotions, lessons } from './lessons';
import { drillsInRound, newRound, press, results, type Round } from './round';

describe('Lessons', () => {
  it('each allow their own motions and the earlier Lessons’ motions', () => {
    expect(Object.keys(lessonMotions(0)).sort()).toEqual(['h', 'j', 'k', 'l']);
    expect(Object.keys(lessonMotions(2)).sort()).toEqual([...'hjklwbeWBE', '0', '^', '$'].sort());
    expect(Object.keys(lessonMotions(3)).sort()).toEqual(
      [...'hjklwbeWBE', '0', '^', '$', ...'fFtT', ';', ','].sort(),
    );
    expect(Object.keys(lessonMotions(4)).sort()).toEqual(
      [...'hjklwbeWBE', '0', '^', '$', ...'fFtT', ';', ',', 'G', 'gg'].sort(),
    );
  });

  it('are labelled with the motions they add', () => {
    expect(lessons.map((lesson) => lesson.adds.join(' ')).slice(3)).toEqual([
      'f F t T ; ,',
      'gg G',
    ]);
  });

  it('have tidy texts: plain ASCII, no spaces at a line end, and short enough for a phone', () => {
    for (const lesson of lessons) {
      for (const text of lesson.texts) {
        for (const line of text) {
          expect(line).toMatch(/^[\x20-\x7e]*$/);
          expect(line).not.toMatch(/ $/);
          expect(line.length).toBeLessThanOrEqual(32);
        }
        expect(text[0]).not.toBe('');
        expect(text.at(-1)).not.toBe('');
      }
    }
  });

  it('can reach every character of every text from its first one', () => {
    lessons.forEach((lesson, index) => {
      for (const text of lesson.texts) {
        const reach = fewestKeys(text, { line: 0, col: 0, want: 0 }, lessonMotions(index));
        text.forEach((line, l) => {
          for (let col = l === 0 ? 1 : 0; col < Math.max(1, line.length); col++) {
            expect(reach.has(placeKey({ line: l, col })), `${text[l]} at ${col}`).toBe(true);
          }
        });
      }
    });
  });
});

describe('a round of Drills', () => {
  it('has 10 Drills, each target reachable with its Lesson’s motions and not the start', () => {
    lessons.forEach((_lesson, index) => {
      for (const seed of [1, 2, 3]) {
        const round = newRound(index, seededRandom(seed));
        expect(round.drills).toHaveLength(drillsInRound);
        for (const drill of round.drills) {
          expect(drill.target).not.toEqual(drill.start);
          const reach = fewestKeys(
            drill.text,
            { ...drill.start, want: drill.start.col },
            lessonMotions(index),
          );
          expect(reach.get(placeKey(drill.target))).toBe(drill.fewest);
          expect(drill.text[drill.target.line]![drill.target.col]).toMatch(/\S/);
        }
      }
    });
  });

  it('is the same round for the same seed', () => {
    expect(newRound(1, seededRandom(5)).drills).toEqual(newRound(1, seededRandom(5)).drills);
  });

  /** Plays one Drill with h j k l: rows down, then across. */
  function solve(round: Round, at: number, extra: string[] = []): Round {
    const drill = round.drills[round.current]!;
    const keys = [...extra];
    const down = drill.target.line - drill.start.line;
    keys.push(...Array<string>(Math.abs(down)).fill(down > 0 ? 'j' : 'k'));
    // j and k keep the start's column where the line is long enough.
    const landed = Math.min(
      drill.start.col,
      Math.max(0, drill.text[drill.target.line]!.length - 1),
    );
    const across = drill.target.col - landed;
    keys.push(...Array<string>(Math.abs(across)).fill(across > 0 ? 'l' : 'h'));
    for (const key of keys) round = press(round, key, at);
    return round;
  }

  it('moves on when the cursor reaches the target, and scores the round at the end', () => {
    let round = newRound(0, seededRandom(9));
    expect(round.current).toBe(0);
    round = solve(round, 1000, ['x', 'Escape']);
    expect(round.current).toBe(1);
    expect(round.vim.cursor).toMatchObject(round.drills[1]!.start);
    for (let i = 1; i < drillsInRound; i++) round = solve(round, 1000 + i * 1500);
    expect(round.current).toBe(drillsInRound);

    const score = results(round)!;
    expect(score.seconds).toBe(13.5);
    expect(score.fewest).toBe(round.drills.reduce((sum, drill) => sum + drill.fewest, 0));
    expect(score.presses).toBeGreaterThanOrEqual(score.fewest + 2);
    // The worst Drills first, and only Drills that took extra keys.
    expect(score.mostExtra.length).toBeGreaterThan(0);
    expect(score.mostExtra.length).toBeLessThanOrEqual(3);
    const extras = score.mostExtra.map((d) => d.extra);
    expect(extras).toEqual([...extras].sort((a, b) => b - a));
    expect(extras.every((extra) => extra > 0)).toBe(true);
  });

  it('counts ignored keys, and remembers the last one to note it', () => {
    let round = newRound(0, seededRandom(9));
    round = press(round, 'x', 0);
    expect(round.ignored).toBe('x');
    expect(round.presses[0]).toBe(1);
    round = press(round, 'Escape', 10);
    expect(round.ignored).toBeUndefined();
    expect(round.presses[0]).toBe(2);
  });

  it('has no results until the last Drill is done', () => {
    expect(results(newRound(0, seededRandom(9)))).toBeUndefined();
  });
});
