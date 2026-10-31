import { describe, expect, it } from 'vitest';
import { tools } from './registry';

describe('Tool addresses', () => {
  it('are lowercase words joined by hyphens', () => {
    // A dot would read as an extension when naming a typed Tool's results.
    for (const { address } of tools) expect(address).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
