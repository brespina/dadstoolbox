// The typing test's settings bar: what the visitor can choose before a test.
// A later setting (Layout, #91) is a new field here.

import type { TestLength } from './typing';

export const secondsChoices = [15, 30, 60, 120] as const;
export const wordChoices = [10, 25, 50, 100] as const;

export interface TypingSettings {
  /** A Time test or a Words test. */
  test: 'time' | 'words';
  seconds: (typeof secondsChoices)[number];
  words: (typeof wordChoices)[number];
  /** Capitals and punctuation in the words. */
  punctuation: boolean;
  /** Numbers among the words. */
  numbers: boolean;
}

export const defaultSettings: TypingSettings = {
  test: 'time',
  seconds: 30,
  words: 25,
  punctuation: false,
  numbers: false,
};

export function testLength(settings: TypingSettings): TestLength {
  return settings.test === 'time'
    ? { kind: 'time', seconds: settings.seconds }
    : { kind: 'words', count: settings.words };
}
