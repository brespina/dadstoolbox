// One Vitest test file per Tool: call `run` with the sample file and check what comes out.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

const sample = () =>
  new File([readFileSync(new URL('sample.txt', import.meta.url))], 'sample.txt', {
    type: 'text/plain',
  });

describe('Template Tool', () => {
  it('makes one copy of the text, named with the detail "copy"', async () => {
    const results = await run(sample(), { capitals: false });
    expect(results).toHaveLength(1);
    expect(results[0]!.detail).toBe('copy');
    expect(results[0]!.blob.type).toBe('text/plain');
    expect(await results[0]!.blob.text()).toBe('Hello from the template.\n');
  });

  it('writes the text in capitals when that option is ticked', async () => {
    const [result] = await run(sample(), { capitals: true });
    expect(await result!.blob.text()).toBe('HELLO FROM THE TEMPLATE.\n');
  });

  it('fails with a plain reason for an empty file', async () => {
    const empty = new File([], 'empty.txt', { type: 'text/plain' });
    const failure = await run(empty, { capitals: false }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This file is empty. Choose a file with some text in it.',
    );
  });
});
