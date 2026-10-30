import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ToolFailure } from '../types';
import { run } from './run';

/** Reads the code in a PNG back to text, with decoders that are not the Tool's own. */
async function readCode(blob: Blob) {
  const png = PNG.sync.read(Buffer.from(await blob.arrayBuffer()));
  const rgba = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
  return jsQR(rgba, png.width, png.height)?.data;
}

describe('Wi-Fi QR code maker', () => {
  it('makes one PNG a phone reads as a password-protected network', async () => {
    const results = await run('', { name: 'Garden Shed', password: 'tomatoes42' });
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('image/png');
    expect(results[0]!.detail).toBeUndefined();
    expect(await readCode(results[0]!.blob)).toBe('WIFI:T:WPA;S:Garden Shed;P:tomatoes42;;');
  });

  it('makes an open-network code when the password is empty', async () => {
    const [result] = await run('', { name: 'Cafe Guest', password: '' });
    expect(await readCode(result!.blob)).toBe('WIFI:T:nopass;S:Cafe Guest;;');
  });

  it('escapes the characters the Wi-Fi code uses itself', async () => {
    const [result] = await run('', { name: 'a\\b;c,d:e"f', password: 'p;w:"x\\,' });
    expect(await readCode(result!.blob)).toBe(
      'WIFI:T:WPA;S:a\\\\b\\;c\\,d\\:e\\"f;P:p\\;w\\:\\"x\\\\\\,;;',
    );
  });

  it('makes nothing, and does not fail, until a network name is typed', async () => {
    expect(await run('', { name: '', password: 'secret' })).toEqual([]);
    expect(await run('', { name: '   ', password: '' })).toEqual([]);
  });

  it('fails with a plain reason when it is too long for one code', async () => {
    const failure = await run('', { name: 'Home', password: 'a'.repeat(5000) }).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This is too long for one code. Try a shorter name or password.',
    );
  });
});
