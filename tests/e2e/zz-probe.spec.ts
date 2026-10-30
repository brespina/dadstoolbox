// Throwaway (#47): what each page-test browser can make. Removed before the PR.
import { test } from '@playwright/test';

test('probe encoders', async ({ page, browserName }) => {
  await page.goto('./');
  const out = await page.evaluate(async () => {
    const g = globalThis as unknown as Record<
      string,
      { isConfigSupported(c: object): Promise<{ supported: boolean }> }
    >;
    const r: Record<string, unknown> = {
      ua: navigator.userAgent,
      VideoEncoder: 'VideoEncoder' in self,
      VideoDecoder: 'VideoDecoder' in self,
      AudioEncoder: 'AudioEncoder' in self,
      AudioDecoder: 'AudioDecoder' in self,
    };
    const ask = async (api: string, config: object) => {
      try {
        return (await g[api]!.isConfigSupported(config)).supported;
      } catch (e) {
        return String(e);
      }
    };
    const video = (codec: string, width: number, height: number) =>
      ask('VideoEncoder', { codec, width, height, bitrate: 2e6, framerate: 30 });
    const audio = { sampleRate: 48000, numberOfChannels: 2 };
    r.avc720 = await video('avc1.42001f', 1280, 720);
    r.avcHigh1080 = await video('avc1.640028', 1920, 1080);
    r.avc4k = await video('avc1.640033', 3840, 2160);
    r.hevcEnc = await video('hvc1.1.6.L93.B0', 1280, 720);
    r.aacEnc = await ask('AudioEncoder', { codec: 'mp4a.40.2', bitrate: 128000, ...audio });
    r.opusEnc = await ask('AudioEncoder', { codec: 'opus', bitrate: 128000, ...audio });
    r.aacDec = await ask('AudioDecoder', { codec: 'mp4a.40.2', ...audio });
    r.avcDec = await ask('VideoDecoder', {
      codec: 'avc1.42001f',
      codedWidth: 1280,
      codedHeight: 720,
    });
    r.hevcDec = await ask('VideoDecoder', {
      codec: 'hvc1.1.6.L93.B0',
      codedWidth: 1280,
      codedHeight: 720,
    });
    return r;
  });
  console.log(`PROBE ${browserName}: ${JSON.stringify(out)}`);
});
