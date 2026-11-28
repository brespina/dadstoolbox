import { describe, expect, it } from 'vitest';
import {
  clearInterrupt,
  createInterruptBuffer,
  interruptRequested,
  requestInterrupt,
} from './interrupt-channel';

describe('the interrupt buffer', () => {
  it('starts clear, holds 2 once requested, and clears again', () => {
    const buffer = createInterruptBuffer();
    expect(interruptRequested(buffer)).toBe(false);
    requestInterrupt(buffer);
    expect(interruptRequested(buffer)).toBe(true);
    // Pyodide reads one byte, and 2 is the number for SIGINT.
    expect(new Uint8Array(buffer)[0]).toBe(2);
    clearInterrupt(buffer);
    expect(interruptRequested(buffer)).toBe(false);
  });
});
