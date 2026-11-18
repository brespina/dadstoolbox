<script lang="ts">
  // One PDF's pages, on its Ready row, where the person places Marks (by a tap or "Add to
  // page"), moves them (drag or arrow keys) and resizes them. The rules are in marks.ts;
  // PlacedMark and MarkControls turn events into calls on them. The page viewer (pdf.js)
  // loads here with a dynamic import(), behind "Getting ready…", so it is never in another
  // Tool's page files (ADR-0006). Pages draw as they come near view, at the row's width,
  // and are freed far off screen.
  import { tick } from 'svelte';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import { fillText as fill, text } from '../../text';
  import { ToolFailure, type FileOptionsProps } from '../types';
  import { hasSignature, padShape, tool, type Mark, type Options } from './declaration';
  import MarkControls from './MarkControls.svelte';
  import { placeCentred, placeLowerMiddle, resize, startingWidth, type Fit } from './marks';
  import { paintOnCanvas } from './paint';
  import PlacedMark from './PlacedMark.svelte';
  import type { ShownPage, ShownPdf } from './viewer';

  let { file, options, change, pageOptions }: FileOptionsProps<Options> = $props();

  const notes = tool.notes as Record<string, string>;
  /** Makes element ids unique when several PDFs are chosen. */
  const uid = $props.id();
  /** What a Mark is called, by kind. */
  const kindNames: Record<Mark['kind'], string> = { signature: notes.kindSignature! };
  /** What the next tap or "Add to page" puts down. #112 adds Text and Today's date. */
  let kind: Mark['kind'] = $state('signature');
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
    // Every Signature Mark has the same picture, so any one will do.
    paintOnCanvas(
      { kind: 'signature', page: 1, x: 0, y: 0, width: startingWidth('signature') },
      chosen,
    )
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

  // The Mark chosen to change or remove, by its place in the list.
  let chosenMark: number | null = $state(null);

  /** A page's shape and the Signature's make a Mark's height (ADR-0007). */
  const fitOf = (page: ShownPage): Fit => ({
    markAspect: signature.shape,
    pageAspect: page.width / page.height,
  });
  const labelOf = (mark: Mark) =>
    fill(notes.markLabel!, { kind: kindNames[mark.kind], page: mark.page });
  const markId = (index: number) => `${uid}-mark-${index}`;
  const addId = (page: number) => `${uid}-add-${page}`;

  /** Adds a Mark to the list and chooses it. Gives its place in the list. */
  function add(mark: Mark): number {
    const index = options.marks.length;
    // A new list: the default `marks` array is shared by every chosen PDF.
    change({ marks: [...options.marks, mark] });
    chosenMark = index;
    return index;
  }

  function replace(index: number, mark: Mark) {
    change({ marks: options.marks.map((was, i) => (i === index ? mark : was)) });
  }

  /** "Add to page N": the lower middle of the page, with the new Mark focused. */
  async function addToPage(number: number, page: ShownPage) {
    const index = add(placeLowerMiddle(kind, number, fitOf(page)));
    await tick();
    document.getElementById(markId(index))?.focus();
  }

  /** Takes a Mark away, and moves focus to its page's Add button, not to the page's top. */
  async function remove(index: number) {
    const { page } = options.marks[index]!;
    change({ marks: options.marks.filter((_, i) => i !== index) });
    chosenMark = null;
    await tick();
    document.getElementById(addId(page))?.focus();
  }

  // A press that didn't move is a tap; one that moved was scrolling.
  let pressed: { id: number; x: number; y: number } | null = null;
  function press(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
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
    const index = add(
      placeCentred(
        kind,
        number,
        { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height },
        fitOf(page),
      ),
    );
    // So the arrow keys work at once; the page keeps its place.
    void tick().then(() => document.getElementById(markId(index))?.focus({ preventScroll: true }));
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
    <ChoiceGroup
      legend={notes.addLegend!}
      name={`${uid}-kind`}
      choices={[{ value: 'signature', label: kindNames.signature }]}
      bind:value={kind}
    />
    <ol class="pages">
      {#each shown.pages as page, index (index)}
        {@const number = index + 1}
        <li class="page-item">
          <!-- A tap places a Mark; "Add to page" is the way without a pointer. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="sheet"
            role="group"
            aria-label={fill(notes.pageLabel!, { page: number, name: file.name })}
            style:aspect-ratio={`${page.width} / ${page.height}`}
            onpointerdown={press}
            onpointerup={(event) => release(event, number, page)}
            onpointercancel={() => (pressed = null)}
          >
            <!-- No pixels until it is drawn. -->
            <canvas
              width="0"
              height="0"
              aria-hidden="true"
              {@attach (canvas) => drawNearView(canvas, page)}
            ></canvas>
            {#each options.marks as mark, markIndex (markIndex)}
              {#if mark.page === number}
                <PlacedMark
                  id={markId(markIndex)}
                  {mark}
                  fit={fitOf(page)}
                  label={labelOf(mark)}
                  chosen={chosenMark === markIndex}
                  blank={!signature.url}
                  onchoose={() => (chosenMark = markIndex)}
                  onchange={(next) => replace(markIndex, next)}
                  onremove={() => remove(markIndex)}
                >
                  {#if signature.url}
                    <img src={signature.url} alt="" draggable="false" />
                  {:else}
                    <span>{kindNames[mark.kind]}</span>
                  {/if}
                </PlacedMark>
              {/if}
            {/each}
          </div>
          <div class="page-tools">
            <button
              type="button"
              id={addId(number)}
              class="small-button"
              onclick={() => addToPage(number, page)}
              >{fill(notes.addToPage!, { page: number })}</button
            >
            {#if chosenMark !== null && options.marks[chosenMark]?.page === number}
              {@const index = chosenMark}
              {@const chosen = options.marks[index]!}
              <MarkControls
                label={labelOf(chosen)}
                onsmaller={() => replace(index, resize(chosen, 'smaller', fitOf(page)))}
                onbigger={() => replace(index, resize(chosen, 'bigger', fitOf(page)))}
                onremove={() => remove(index)}
              />
            {/if}
          </div>
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
  .sheet {
    position: relative;
    width: 100%;
    background: #fff;
    box-shadow: 0 0 0 1px var(--line);
    overflow: hidden;
  }

  .sheet canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* The Signature's picture fills its Mark, whose shape it gives. */
  .page-item img {
    display: block;
    width: 100%;
    height: 100%;
  }

  .page-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
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
