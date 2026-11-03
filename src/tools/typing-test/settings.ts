// The typing test's settings bar: what the visitor can choose before a test.
// Later switches (Punctuation and Numbers, #90) are new fields here.

import type { Layout } from './layouts';
import type { TestLength } from './typing';

export const secondsChoices = [15, 30, 60, 120] as const;
export const wordChoices = [10, 25, 50, 100] as const;

export interface TypingSettings {
  /** A Time test or a Words test. */
  test: 'time' | 'words';
  seconds: (typeof secondsChoices)[number];
  words: (typeof wordChoices)[number];
  /** Which Layout the keys are read as; 'own' is whatever the visitor's keyboard types. */
  layout: Layout;
}

export const defaultSettings: TypingSettings = {
  test: 'time',
  seconds: 30,
  words: 25,
  layout: 'own',
};

export function testLength(settings: TypingSettings): TestLength {
  return settings.test === 'time'
    ? { kind: 'time', seconds: settings.seconds }
    : { kind: 'words', count: settings.words };
}
