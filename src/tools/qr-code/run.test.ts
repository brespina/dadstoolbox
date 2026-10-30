import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

/** Reads the code in a PNG back to text, with decoders that are not the Tool's own. */
async function readCode(blob: Blob) {
  const png = PNG.sync.read(Buffer.from(await blob.arrayBuffer()));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return { text: jsQR(rgba, png.width, png.height)?.data, width: png.width, height: png.height };
}

describe('QR code maker', () => {
  it.each([
    'https://example.com/menu?table=4',
    'Wi-Fi password: garden shed 42',
    'Café crème ☕ for Zoë',
  ])('makes one PNG that reads back as %j', async (typed) => {
    const results = await run(typed, {});
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('image/png');
    expect(results[0]!.detail).toBeUndefined();
    expect((await readCode(results[0]!.blob)).text).toBe(typed);
  });

  it('is square and big enough to print', async () => {
    const code = await readCode((await run('hello', {}))[0]!.blob);
    expect(code.width).toBe(code.height);
    expect(code.width).toBeGreaterThanOrEqual(600);
  });

  it('reads back a long text near the limit', async () => {
    const typed = 'a'.repeat(2000);
    expect((await readCode((await run(typed, {}))[0]!.blob)).text).toBe(typed);
  });

  it('fails with a plain reason when the text is too long for one code', async () => {
    const failure = await run('a'.repeat(5000), {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This is too long for one code. Try a shorter text.',
    );
  });
});
