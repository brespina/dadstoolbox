import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeeper, keepKeys, openKept, type KeepStore } from './keep';
import { maxProgramBytes } from './files';

/** A stand-in for localStorage. */
function memory(start: Record<string, string> = {}) {
  const map = new Map(Object.entries(start));
  const store: KeepStore & { map: Map<string, string> } = {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return store;
}

/** A storage that refuses to write, as a full or blocked one does. */
function refusing(start: Record<string, string> = {}) {
  const store = memory(start);
  store.setItem = () => {
    throw new DOMException('full', 'QuotaExceededError');
  };
  return store;
}

const kept = { [keepKeys.choice]: 'keep', [keepKeys.program]: 'print("kept")' };

describe('openKept', () => {
  it('opens on Never keep when nothing is stored, and stores nothing', () => {
    const store = memory();
    expect(openKept(store)).toEqual({ choice: 'never' });
    expect(store.map.size).toBe(0);
  });

  it('returns the kept Program when Keep was chosen', () => {
    expect(openKept(memory(kept))).toEqual({ choice: 'keep', program: 'print("kept")' });
  });

  it('keeps an empty Program: a person may clear the editor', () => {
    const store = memory({ ...kept, [keepKeys.program]: '' });
    expect(openKept(store)).toEqual({ choice: 'keep', program: '' });
  });

  it('opens on Never keep with no storage, or storage that throws on reading', () => {
    expect(openKept(undefined)).toEqual({ choice: 'never' });
    const throwing: KeepStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(openKept(throwing)).toEqual({ choice: 'never' });
  });

  it.each([
    ['a choice written by something else', { ...kept, [keepKeys.choice]: 'yes' }],
    ['a Program with no choice', { [keepKeys.program]: 'print(1)' }],
    ['a choice with no Program', { [keepKeys.choice]: 'keep' }],
    ['a Program with a NUL byte', { ...kept, [keepKeys.program]: 'a\u0000b' }],
    [
      'a Program over the size cap',
      { ...kept, [keepKeys.program]: 'x'.repeat(maxProgramBytes + 1) },
    ],
    [
      'a Program over the cap in bytes, not characters',
      { ...kept, [keepKeys.program]: 'é'.repeat(maxProgramBytes / 2 + 1) },
    ],
  ])('ignores and removes %s', (_name, start) => {
    const store = memory(start);
    expect(openKept(store)).toEqual({ choice: 'never' });
    expect(store.map.size).toBe(0);
  });

  it('accepts a Program exactly at the cap', () => {
    const program = 'x'.repeat(maxProgramBytes);
    expect(openKept(memory({ ...kept, [keepKeys.program]: program }))).toEqual({
      choice: 'keep',
      program,
    });
  });

  it('only removes the keys it owns', () => {
    const store = memory({ ...kept, [keepKeys.choice]: 'no', other: 'mine' });
    openKept(store);
    expect([...store.map.keys()]).toEqual(['other']);
  });
});

describe('createKeeper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function keeper(store: KeepStore | undefined, initial: 'never' | 'keep' = 'never') {
    const onRefused = vi.fn();
    return { onRefused, keeper: createKeeper({ store, initial, onRefused }) };
  }

  it('stores nothing under Never keep, however much is typed', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    k.edited('a');
    vi.advanceTimersByTime(10_000);
    k.flush();
    expect(store.map.size).toBe(0);
  });

  it('Keep stores the choice and the Program at once, under namespaced keys', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    expect(k.choose('keep', 'print(1)')).toBe(true);
    expect(Object.fromEntries(store.map)).toEqual({
      'dadstoolbox:run-python:keep': 'keep',
      'dadstoolbox:run-python:program': 'print(1)',
    });
  });

  it('writes an edit about half a second after typing stops, not on every key', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    k.choose('keep', 'a');
    k.edited('ab');
    vi.advanceTimersByTime(400);
    k.edited('abc');
    vi.advanceTimersByTime(400);
    expect(store.map.get(keepKeys.program)).toBe('a');
    vi.advanceTimersByTime(100);
    expect(store.map.get(keepKeys.program)).toBe('abc');
  });

  it('writes a pending edit at once on flush, as when the page is hidden', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    k.choose('keep', 'a');
    k.edited('ab');
    k.flush();
    expect(store.map.get(keepKeys.program)).toBe('ab');
    vi.advanceTimersByTime(1_000);
    expect(store.map.get(keepKeys.program)).toBe('ab');
  });

  it('writes edits when the page opened already on Keep', () => {
    const store = memory(kept);
    const { keeper: k } = keeper(store, 'keep');
    k.edited('print(2)');
    vi.advanceTimersByTime(500);
    expect(store.map.get(keepKeys.program)).toBe('print(2)');
  });

  it('Never keep deletes both entries at once, and a pending edit does not bring them back', () => {
    const store = memory(kept);
    const { keeper: k } = keeper(store, 'keep');
    k.edited('typed just now');
    expect(k.choose('never', 'typed just now')).toBe(true);
    expect(store.map.size).toBe(0);
    vi.advanceTimersByTime(5_000);
    k.flush();
    expect(store.map.size).toBe(0);
  });

  it('a storage that refuses the first write returns false and leaves nothing', () => {
    const store = refusing();
    const { keeper: k, onRefused } = keeper(store);
    expect(k.choose('keep', 'print(1)')).toBe(false);
    expect(store.map.size).toBe(0);
    // The caller is told by the return value, so onRefused is not also called.
    expect(onRefused).not.toHaveBeenCalled();
    k.edited('more');
    vi.advanceTimersByTime(1_000);
    expect(store.map.size).toBe(0);
  });

  it('no storage at all refuses Keep', () => {
    const { keeper: k } = keeper(undefined);
    expect(k.choose('keep', 'a')).toBe(false);
  });

  it('removes a half-written choice when only the second write fails', () => {
    const store = memory();
    let writes = 0;
    store.setItem = (key, value) => {
      if (++writes === 2) throw new Error('full');
      store.map.set(key, value);
    };
    const { keeper: k } = keeper(store);
    expect(k.choose('keep', 'a')).toBe(false);
    expect(store.map.size).toBe(0);
  });

  it('a later write that fails calls onRefused and leaves nothing kept', () => {
    const store = memory();
    const { keeper: k, onRefused } = keeper(store);
    k.choose('keep', 'a');
    store.setItem = () => {
      throw new Error('full');
    };
    k.edited('ab');
    vi.advanceTimersByTime(500);
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(store.map.size).toBe(0);
    k.edited('abc');
    vi.advanceTimersByTime(500);
    expect(onRefused).toHaveBeenCalledTimes(1);
  });

  it('a Program grown over the cap is refused the same way, not stored', () => {
    const store = memory();
    const { keeper: k, onRefused } = keeper(store);
    k.choose('keep', 'a');
    k.edited('x'.repeat(maxProgramBytes + 1));
    vi.advanceTimersByTime(500);
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(store.map.size).toBe(0);
  });

  it('refuses Keep for a Program already over the cap', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    expect(k.choose('keep', 'x'.repeat(maxProgramBytes + 1))).toBe(false);
    expect(store.map.size).toBe(0);
  });

  it('dispose writes a pending edit, then stops', () => {
    const store = memory();
    const { keeper: k } = keeper(store);
    k.choose('keep', 'a');
    k.edited('ab');
    k.dispose();
    expect(store.map.get(keepKeys.program)).toBe('ab');
    k.edited('abc');
    vi.advanceTimersByTime(1_000);
    expect(store.map.get(keepKeys.program)).toBe('ab');
  });
});
