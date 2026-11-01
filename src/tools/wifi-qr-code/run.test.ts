import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { plainStyle } from '../../qr/style';
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
    const results = await run('', {
      name: 'Garden Shed',
      password: 'tomatoes42',
      style: plainStyle,
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.blob.type).toBe('image/png');
    expect(results[0]!.detail).toBeUndefined();
    expect(await readCode(results[0]!.blob)).toBe('WIFI:T:WPA;S:Garden Shed;P:tomatoes42;;');
  });

  it('makes a styled code that reads back, with its warnings', async () => {
    const style = { ...plainStyle, code: '#004d40', background: '#ffffff', noBackground: true };
    const [result] = await run('', { name: 'Garden Shed', password: 'tomatoes42', style });
    expect(await readCode(result!.blob)).toBe('WIFI:T:WPA;S:Garden Shed;P:tomatoes42;;');
    expect(result!.warnings).toEqual(['Put this on a light background so phones can read it.']);
  });

  it('makes an SVG instead when the Style says to save as one', async () => {
    const style = { ...plainStyle, saveAs: 'svg' } as const;
    const [result] = await run('', { name: 'Garden Shed', password: 'tomatoes42', style });
    expect(result!.blob.type).toBe('image/svg+xml');
    expect(await result!.blob.text()).toContain('<svg ');
  });

  it('makes an open-network code when the password is empty', async () => {
    const [result] = await run('', { name: 'Cafe Guest', password: '', style: plainStyle });
    expect(await readCode(result!.blob)).toBe('WIFI:T:nopass;S:Cafe Guest;;');
  });

  it('escapes the characters the Wi-Fi code uses itself', async () => {
    const [result] = await run('', {
      name: 'a\\b;c,d:e"f',
      password: 'p;w:"x\\,',
      style: plainStyle,
    });
    expect(await readCode(result!.blob)).toBe(
      'WIFI:T:WPA;S:a\\\\b\\;c\\,d\\:e\\"f;P:p\\;w\\:\\"x\\\\\\,;;',
    );
  });

  it('makes nothing, and does not fail, until a network name is typed', async () => {
    expect(await run('', { name: '', password: 'secret', style: plainStyle })).toEqual([]);
    expect(await run('', { name: '   ', password: '', style: plainStyle })).toEqual([]);
  });

  it('fails with a plain reason when it is too long for one code', async () => {
    const failure = await run('', {
      name: 'Home',
      password: 'a'.repeat(5000),
      style: plainStyle,
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      'This is too long for one code. Try a shorter name or password.',
    );
  });

  it('fails with a plain reason when the logo is not a picture the browser can open', async () => {
    // Plain Node cannot open any picture, as a browser cannot open a file that is not one.
    const logo = new File(['not a picture'], 'logo.png', { type: 'image/png' });
    const failure = await run('', {
      name: 'Garden Shed',
      password: '',
      style: { ...plainStyle, logo },
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ToolFailure);
    expect((failure as ToolFailure).reason).toBe(
      "This logo didn't open. Choose a PNG, JPG, WebP or SVG.",
    );
  });
});
