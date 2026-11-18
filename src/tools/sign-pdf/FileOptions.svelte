<script lang="ts">
  // One PDF's pages, on its Ready row, where the person taps to place a Signature Mark.
  // The page viewer (pdf.js) loads here with a dynamic import(), behind "Getting ready…",
  // so it is never in another Tool's page files (ADR-0006). Pages draw as they come near
  // view, at the row's width, and are freed far off screen.
  import { fillText as fill, text } from '../../text';
  import { ToolFailure, type FileOptionsProps } from '../types';
  import { hasSignature, padShape, tool, type Mark, type Options } from './declaration';
  import { paintOnCanvas } from './paint';
  import type { ShownPage, ShownPdf } from './viewer';

  let { file, options, change, pageOptions }: FileOptionsProps<Options> = $props();

  const notes = tool.notes as Record<string, string>;
  /** A new Signature Mark's width, as a fraction of the page's. */
  const signatureWidth = 1 / 3;
  /** How far, in CSS pixels, a press may move and still count as a tap. */
  const tapSlop = 10;

  let shown: ShownPdf | null = $state.raw(null);
  // The shared check's reason, or the shared fallback, shown in place of the pages.
  let problem: string | null = $state(null);

  $effect(() => {
    const chosen = file;
    let current = true;
    let opened: ShownPdf | undefined;
    import('./viewer')
      .then(async (module) => {
        opened = await module.showPdf(chosen);
        if (current) shown = opened;
        else opened.close();
      })
      .catch((error: unknown) => {
        if (!current) return;
        if (error instanceof ToolFailure) problem = error.reason;
        else {
          console.error('Could not show the pages', error);
          problem = text.tool.failedFallback;
        }
      });
    return () => {
      current = false;
      opened?.close();
    };
  });

  // The Signature's picture, painted at about the size it shows, from the page's options.
  // Blank until the Signature is drawn: its Marks then show their name.
  let signature: { shape: number; url: string | null } = $state.raw({ shape: padShape, url: null });
  $effect(() => {
    const chosen = pageOptions;
    if (!chosen || !hasSignature(chosen.signature)) {
      signature = { shape: padShape, url: null };
      return;
    }
    let current = true;
    let url: string | undefined;
    paintOnCanvas(newMark('signature', 1, 0, 0), chosen)
      .then(async (picture) => {
        const width = 600;
        const png = await picture.paint(width, Math.max(1, Math.round(width / picture.shape)));
        if (!current) return;
        url = URL.createObjectURL(
          new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
        );
        signature = { shape: picture.shape, url };
      })
      .catch((error: unknown) => console.error('Could not paint the Signature', error));
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  });

  function newMark(kind: Mark['kind'], page: number, x: number, y: number): Mark {
    return { kind, page, x, y, width: signatureWidth };
  }

  // The Mark chosen to change or remove, by its place in the list.
  let chosenMark: number | null = $state(null);

  /** Places a Signature Mark centred on a point, as fractions of the page, inside it. */
  function place(number: number, page: ShownPage, x: number, y: number) {
    const width = signatureWidth;
    // The Mark's height on the page, as a fraction of the page's height.
    const tall = (width * page.width) / signature.shape / page.height;
    const inside = (start: number, size: number) => Math.min(Math.max(start, 0), 1 - size);
    const mark = newMark(
      'signature',
      number,
      inside(x - width / 2, width),
      inside(y - tall / 2, tall),
    );
    change({ marks: [...options.marks, mark] });
    chosenMark = options.marks.length;
  }

  function remove(index: number) {
    change({ marks: options.marks.filter((_, i) => i !== index) });
    chosenMark = null;
  }

  // A press that didn't move is a tap; one that moved was scrolling.
  let pressed: { id: number; x: number; y: number } | null = null;
  function press(event: PointerEvent) {
    pressed = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function release(event: PointerEvent, number: number, page: ShownPage) {
    const was = pressed;
    pressed = null;
    if (!was || was.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - was.x, event.clientY - was.y) > tapSlop) return;
    // A tap on a Mark chooses it instead.
    if ((event.target as Element).closest('.mark')) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    place(
      number,
      page,
      (event.clientX - box.left) / box.width,
      (event.clientY - box.top) / box.height,
    );
  }

  let rowWidth = $state(0);

  /** Draws a page while it is near view, at the row's width; frees it once far away. */
  function drawNearView(canvas: HTMLCanvasElement, page: ShownPage) {
    let drawing: ReturnType<ShownPage['draw']> | null = null;
    let drawnAt = 0;
    let near = false;
    const update = () => {
      if (!near || rowWidth === 0) {
        drawing?.cancel();
        drawing = null;
        drawnAt = 0;
        return;
      }
      if (drawnAt === rowWidth) return;
      drawing?.cancel();
      drawnAt = rowWidth;
      drawing = page.draw(canvas, rowWidth);
      drawing.done.catch((error: unknown) => console.error('Could not draw a page', error));
    };
    // "Near" is within two screens' height either way.
    const watching = new IntersectionObserver(
      ([entry]) => {
        near = entry!.isIntersecting;
        update();
      },
      { rootMargin: '200% 0px' },
    );
    watching.observe(canvas);
    $effect(() => {
      void rowWidth;
      update();
    });
    return () => {
      watching.disconnect();
      drawing?.cancel();
    };
  }
</script>

<div class="sign" bind:clientWidth={rowWidth}>
  {#if problem}
    <p class="problem">{problem}</p>
  {:else if !shown}
    <p>{text.tool.gettingReady}</p>
  {:else}
    <p class="how-to">{notes.howToPlace}</p>
    <ol class="pages">
      {#each shown.pages as page, index (index)}
        {@const number = index + 1}
        <li class="page-item">
          <!-- A tap places a Mark; keyboard placing comes in #113. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="page"
            role="group"
            aria-label={fill(notes.pageLabel!, { page: number, name: file.name })}
            style:aspect-ratio={`${page.width} / ${page.height}`}
            onpointerdown={press}
            onpointerup={(event) => release(event, number, page)}
            onpointercancel={() => (pressed = null)}
          >
            <canvas {@attach (canvas) => drawNearView(canvas, page)} aria-hidden="true"></canvas>
            {#each options.marks as mark, markIndex (markIndex)}
              {#if mark.page === number}
                <button
                  type="button"
                  class="mark"
                  class:chosen={chosenMark === markIndex}
                  class:empty={!signature.url}
                  style:left={`${mark.x * 100}%`}
                  style:top={`${mark.y * 100}%`}
                  style:width={`${mark.width * 100}%`}
                  style:aspect-ratio={signature.shape}
                  aria-label={fill(notes.markLabel!, { page: number })}
                  aria-pressed={chosenMark === markIndex}
                  onclick={() => (chosenMark = chosenMark === markIndex ? null : markIndex)}
                >
                  {#if signature.url}
                    <img src={signature.url} alt="" />
                  {:else}
                    <span>{notes.markEmpty}</span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
          {#if chosenMark !== null && options.marks[chosenMark]?.page === number}
            {@const index = chosenMark}
            <div class="mark-buttons">
              <button
                type="button"
                class="small-button"
                aria-label={fill(notes.removeLabel!, { page: number })}
                onclick={() => remove(index)}>{notes.remove}</button
              >
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .sign {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sign > p {
    margin: 0;
  }

  .problem {
    color: var(--problem);
    font-weight: 600;
  }

  .pages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Each page keeps its shape before it is drawn, so scrolling doesn't jump. */
  .page {
    position: relative;
    width: 100%;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
    overflow: hidden;
  }

  .page canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .mark {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 2px dashed transparent;
    background: transparent;
    cursor: pointer;
  }

  .mark img {
    width: 100%;
    height: 100%;
  }

  /* Before a Signature is drawn: its name in a dashed box, dark on the white page. */
  .mark.empty {
    border-color: #555;
    color: #222;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    background: rgb(255 255 255 / 0.85);
  }

  .mark.chosen {
    border: 2px solid var(--focus);
  }

  .mark:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .mark-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  /* At least 44 x 44 px to tap, like the shared page's small buttons. */
  .small-button {
    min-height: 2.75rem;
    min-width: 2.75rem;
    padding: 0.25rem 1rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--action);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
