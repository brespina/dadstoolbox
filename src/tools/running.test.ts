import { describe, expect, it, vi } from 'vitest';
import { createTakenNames, runContext, runOnce, type RunOutcome, type TakenNames } from './running';
import { ToolFailure, type Reason } from './types';

const made = (type: string, detail?: string) => ({ blob: new Blob(['x'], { type }), detail });

const namesIn = (outcome: RunOutcome) => {
  if ('reason' in outcome) throw new Error(`Expected files, got: ${outcome.reason}`);
  return outcome.files.map((f) => f.name);
};

const names = async (original: string, ...results: ReturnType<typeof made>[]) => {
  const outcome = await runOnce(async () => results, {
    original,
    fallback: 'It did not work.',
    logAs: 'Fake',
  });
  return namesIn(outcome);
};

describe('result names', () => {
  it('add _dtb, with the extension of what was made', async () => {
    expect(await names('IMG_1234.pdf', made('application/pdf'))).toEqual(['IMG_1234_dtb.pdf']);
  });

  it("add the result's detail after _dtb", async () => {
    expect(
      await names('report.pdf', made('application/pdf', 'page1'), made('application/pdf', 'page2')),
    ).toEqual(['report_dtb_page1.pdf', 'report_dtb_page2.pdf']);
  });

  it.each([
    ['IMG_1234.HEIC', 'image/jpeg', 'IMG_1234_dtb.jpg'],
    ['IMG_1234.MOV', 'video/mp4', 'IMG_1234_dtb.mp4'],
    ['clip.mp4', 'audio/mp4', 'clip_dtb.m4a'],
    ['clip.mp4', 'image/gif', 'clip_dtb.gif'],
    ['photo.jpg', 'image/png', 'photo_dtb.png'],
    ['photo.jpg', 'image/webp', 'photo_dtb.webp'],
    ['wifi-qr-code', 'image/svg+xml', 'wifi-qr-code_dtb.svg'],
  ])('take the extension from what was made: %s as %s', async (original, type, name) => {
    expect(await names(original, made(type))).toEqual([name]);
  });

  it("keep the original's extension for any other type, or none if it has none", async () => {
    expect(await names('notes.txt', made('text/plain'))).toEqual(['notes_dtb.txt']);
    expect(await names('fake-code', made('text/plain'))).toEqual(['fake-code_dtb']);
  });
});

describe('names already taken', () => {
  const pdf = made('application/pdf');
  const namesWith = async (taken: TakenNames, original: string) => {
    const outcome = await runOnce(async () => [pdf], {
      original,
      taken,
      fallback: 'It did not work.',
      logAs: 'Fake',
    });
    return namesIn(outcome);
  };

  it('get _2 and _3 when runs share them', async () => {
    const taken = createTakenNames();
    expect([
      ...(await namesWith(taken, 'report.pdf')),
      ...(await namesWith(taken, 'report.pdf')),
      ...(await namesWith(taken, 'report.pdf')),
    ]).toEqual(['report_dtb.pdf', 'report_dtb_2.pdf', 'report_dtb_3.pdf']);
  });

  it('are skipped in any mix of capitals', async () => {
    // Phones and Macs treat Report.PDF and report.pdf as the same file.
    const taken = createTakenNames();
    taken.take('Report_DTB.PDF');
    expect(await namesWith(taken, 'report.pdf')).toEqual(['report_dtb_2.pdf']);
  });

  it('stay free without a list of taken names', async () => {
    expect(await names('report.pdf', pdf)).toEqual(['report_dtb.pdf']);
    expect(await names('report.pdf', pdf)).toEqual(['report_dtb.pdf']);
  });
});

describe('a run that fails', () => {
  const failWith = (error: Error) =>
    runOnce(
      async () => {
        throw error;
      },
      { original: 'bad.pdf', fallback: 'It did not work.', logAs: 'Fake: bad.pdf' },
    );

  it("gives the Tool's own reason", async () => {
    expect(await failWith(new ToolFailure('This PDF has a password.' as Reason))).toEqual({
      reason: 'This PDF has a password.',
    });
  });

  it('gives the fallback for any other error, with the detail in the console only', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await failWith(new TypeError('xref table broken'))).toEqual({
      reason: 'It did not work.',
    });
    const logged = String(consoleError.mock.calls.flat());
    expect(logged).toContain('Fake: bad.pdf');
    expect(logged).toContain('xref table broken');
    consoleError.mockRestore();
  });
});

describe('the run context', () => {
  const watch = () => {
    const seen: (number | string)[] = [];
    const context = runContext({
      progress: (fraction) => seen.push(fraction),
      loading: (on) => seen.push(on ? 'loading' : 'loaded'),
    });
    return { seen, context };
  };

  it('passes progress on only when the whole percent changes', () => {
    const { seen, context } = watch();
    for (const fraction of [0, 0.401, 0.404, 0.75, 0.759, 1]) context.progress(fraction);
    expect(seen).toEqual([0, 0.401, 0.75, 1]);
  });

  it('is loading from the first load until the last of any overlapping loads settles', async () => {
    const { seen, context } = watch();
    let finishFirst!: (value: string) => void;
    const first = context.gettingReady(new Promise<string>((resolve) => (finishFirst = resolve)));
    const second = context.gettingReady(Promise.resolve('library'));
    expect(await second).toBe('library');
    expect(seen).toEqual(['loading']);
    finishFirst('codec');
    expect(await first).toBe('codec');
    expect(seen).toEqual(['loading', 'loaded']);
  });

  it('stops loading when a load fails, and passes the failure on', async () => {
    const { seen, context } = watch();
    await expect(context.gettingReady(Promise.reject(new Error('offline')))).rejects.toThrow(
      'offline',
    );
    expect(seen).toEqual(['loading', 'loaded']);
  });
});
