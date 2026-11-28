import { describe, expect, it } from 'vitest';
import { decideIsolation, type IsolationFacts } from './isolation';

const first: IsolationFacts = {
  isolated: false,
  hasServiceWorkerApi: true,
  controlled: false,
  reloadedBefore: false,
};

describe('decideIsolation', () => {
  it('is isolated when the page already is', () => {
    expect(decideIsolation({ ...first, isolated: true, controlled: true })).toBe('isolated');
    expect(decideIsolation({ ...first, isolated: true, reloadedBefore: true })).toBe('isolated');
  });

  it('registers and reloads once on a first visit', () => {
    expect(decideIsolation(first)).toBe('register-and-reload');
  });

  it('registers and reloads when a service worker controls the page but it is not isolated yet', () => {
    expect(decideIsolation({ ...first, controlled: true })).toBe('register-and-reload');
  });

  it('never asks for a second reload', () => {
    expect(decideIsolation({ ...first, reloadedBefore: true })).toBe('unavailable');
    expect(decideIsolation({ ...first, controlled: true, reloadedBefore: true })).toBe(
      'unavailable',
    );
  });

  it('is unavailable without the service worker API', () => {
    expect(decideIsolation({ ...first, hasServiceWorkerApi: false })).toBe('unavailable');
  });
});
