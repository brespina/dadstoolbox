<script lang="ts">
  // One PDF's pages, on its Ready row, where the person places Marks (by a tap or "Add to
  // page"), moves them (drag or arrow keys) and resizes them. The rules are in marks.ts;
  // PlacedMark and MarkControls turn events into calls on them. The page viewer (pdf.js)
  // loads here with a dynamic import(), behind "Getting ready…", so it is never in another
  // Tool's page files (ADR-0006). Pages draw as they come near view, at the row's width,
  // and are freed far off screen.
  import { tick, untrack } from 'svelte';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import { fillText as fill, text } from '../../text';
  import { ToolFailure, type FileOptionsProps } from '../types';
  import { hasSignature, hasWords, tool, type Mark, type Options } from './declaration';
  import MarkControls from './MarkControls.svelte';
  import {
    keepInside,
    placeCentred,
    placeLowerMiddle,
    resize,
    startingMark,
    withWords,
    type Choice,
    type Fit,
    type Point,
  } from './marks';
  import { paintOnCanvas, shapeOf } from './paint';
  import PlacedMark from './PlacedMark.svelte';
  import type { ShownPage, ShownPdf } from './viewer';

  let { file, options, change, pageOptions }: FileOptionsProps<Options> = $props();

  const notes = tool.notes as Record<string, string>;
  /** Makes element ids unique when several PDFs are chosen. */
  const uid = $props.id();
  /** What a Mark is called, by kind. */
  const kindNames: Record<Mark['kind'], string> = {
    signature: notes.kindSignature!,
    text: notes.kindText!,
  };
  /** What the next tap or "Add to page" puts down. */
  let choice: Choice = $state('signature');
  const choices: { value: Choice; label: string }[] = [
    { value: 'signature', label: notes.kindSignature! },
    { value: 'text', label: notes.kindText! },
    { value: 'date', label: notes.kindDate! },
  ];
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

  /** The page's options, or the starting ones before the page gives them. */
  const settings = () => pageOptions ?? tool.defaultOptions;

  // Each Mark has the picture of what it shows, painted at about the size it shows, from
  // the page's options. Pictures are kept by what they look like (the same words in the
  // same ink, or the Signature as drawn), never by a Mark's place in the list, so removing
  // a Mark leaves the others' pictures alone. A Mark with nothing to paint yet (a Text Mark
  // with no words, a Signature not drawn) has no picture and shows its name in a dashed box.
  const signatureLook = $derived(
    pageOptions && hasSignature(pageOptions.signature)
      ? JSON.stringify([pageOptions.ink, pageOptions.signature])
      : undefined,
  );
  const lookOf = (mark: Mark): string | undefined => {
    if (!pageOptions) return undefined;
    if (mark.kind === 'text')
      return hasWords(mark.text) ? `text|${pageOptions.ink}|${mark.text}` : undefined;
    return signatureLook && `signature|${signatureLook}`;
  };
  /** Picture addresses by look. */
  let pictures: Record<string, string> = $state.raw({});
  const painting = new Set<string>();
  let wanted = new Set<string>();
  let alive = true;

  async function showPicture(look: string, mark: Mark, chosen: Options) {
    try {
      const picture = await paintOnCanvas(mark, chosen);
      const width = 600;
      const png = await picture.paint(width, Math.max(1, Math.round(width / picture.shape)));
      const url = URL.createObjectURL(
        new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
      );
      if (alive && wanted.has(look)) pictures = { ...pictures, [look]: url };
      else URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Could not paint a Mark', error);
    } finally {
      painting.delete(look);
    }
  }

  $effect(() => {
    const chosen = pageOptions;
    const needed = new Map<string, Mark>();
    for (const mark of options.marks) {
      const look = lookOf(mark);
      if (look) needed.set(look, mark);
    }
    if (!chosen) return;
    untrack(() => {
      wanted = new Set(needed.keys());
      // Free the pictures no Mark shows any more.
      const kept: Record<string, string> = {};
      for (const [look, url] of Object.entries(pictures)) {
        if (needed.has(look)) kept[look] = url;
        else URL.revokeObjectURL(url);
      }
      if (Object.keys(kept).length !== Object.keys(pictures).length) pictures = kept;
      for (const [look, mark] of needed) {
        if (look in pictures || painting.has(look)) continue;
        painting.add(look);
        void showPicture(look, mark, chosen);
      }
    });
  });
  $effect(() => () => {
    alive = false;
    for (const url of Object.values(pictures)) URL.revokeObjectURL(url);
  });

  // The Mark chosen to change or remove, by its place in the list.
  let chosenMark: number | null = $state(null);

  /** A page's shape and the Mark's own picture's make its height (ADR-0007). */
  const fitOf = (page: ShownPage, mark: Mark): Fit => ({
    markAspect: shapeOf(mark, settings()),
    pageAspect: page.width / page.height,
  });

  // Drawing, clearing or redrawing the Signature changes its shape, and so the height of
  // every Signature Mark already placed (one placed before drawing has the pad's shape): fit
  // each back inside its page, as `run` does.
  const signatureShape = $derived(shapeOf(startingMark('signature', 1), settings()));
  $effect(() => {
    const pages = shown?.pages;
    void signatureShape;
    if (!pages) return;
    untrack(() => {
      const fitted = options.marks.map((mark) =>
        keepInside(mark, fitOf(pages[mark.page - 1]!, mark)),
      );
      const moved = fitted.some(
        (mark, i) =>
          mark.x !== options.marks[i]!.x ||
          mark.y !== options.marks[i]!.y ||
          mark.width !== options.marks[i]!.width,
      );
      if (moved) change({ marks: fitted });
    });
  });

  const labelOf = (mark: Mark) =>
    fill(notes.markLabel!, { kind: kindNames[mark.kind], page: mark.page });
  const markId = (index: number) => `${uid}-mark-${index}`;
  const wordsId = (index: number) => `${uid}-words-${index}`;
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

  /**
   * Adds the chosen kind of Mark, placed by `put` once its own picture's shape is known, and
   * focuses it: a Text Mark with no words yet gives focus to its words, so typing starts.
   * Today's date holds the device's short date, from the moment it is added.
   */
  async function addChosen(
    number: number,
    page: ShownPage,
    put: (choice: Choice, number: number, fit: Fit, words: string) => Mark,
    focus?: FocusOptions,
  ) {
    const words = choice === 'date' ? new Date().toLocaleDateString() : '';
    const fit = fitOf(page, startingMark(choice, number, words));
    const mark = put(choice, number, fit, words);
    const index = add(mark);
    await tick();
    const wantsWords = mark.kind === 'text' && !hasWords(mark.text);
    document.getElementById(wantsWords ? wordsId(index) : markId(index))?.focus(focus);
  }

  /** "Add to page N": the lower middle of the page, with the new Mark focused. */
  const addToPage = (number: number, page: ShownPage) => addChosen(number, page, placeLowerMiddle);

  /** New words in a Text Mark: it keeps the size of its letters, so it grows with them. */
  function setWords(index: number, page: ShownPage, text: string) {
    const mark = options.marks[index];
    if (mark?.kind !== 'text') return;
    replace(index, withWords(mark, text, fitOf(page, mark), fitOf(page, { ...mark, text })));
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
    const point: Point = {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
    // So the arrow keys (or typing) work at once; the page keeps its place.
    void addChosen(
      number,
      page,
      (choice, number, fit, words) => placeCentred(choice, number, point, fit, words),
      { preventScroll: true },
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
    <ChoiceGroup legend={notes.addLegend!} name={`${uid}-kind`} {choices} bind:value={choice} />
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
                  fit={fitOf(page, mark)}
                  label={labelOf(mark)}
                  chosen={chosenMark === markIndex}
                  blank={!lookOf(mark)}
                  onchoose={() => (chosenMark = markIndex)}
                  onchange={(next) => replace(markIndex, next)}
                  onremove={() => remove(markIndex)}
                >
                  {@const look = lookOf(mark)}
                  {#if look}
                    <!-- No picture for an instant after the words change. -->
                    {#if pictures[look]}
                      <img src={pictures[look]} alt="" draggable="false" />
                    {/if}
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
                onsmaller={() => replace(index, resize(chosen, 'smaller', fitOf(page, chosen)))}
                onbigger={() => replace(index, resize(chosen, 'bigger', fitOf(page, chosen)))}
                onremove={() => remove(index)}
              >
                {#if chosen.kind === 'text'}
                  <label class="words">
                    <span>{notes.wordsLabel}</span>
                    <!-- Typed words are never trimmed or changed; each script sets its own direction. -->
                    <input
                      id={wordsId(index)}
                      type="text"
                      dir="auto"
                      maxlength="100"
                      autocomplete="off"
                      aria-label={fill(notes.controlLabel!, {
                        action: notes.wordsLabel!,
                        mark: labelOf(chosen),
                      })}
                      value={chosen.text}
                      oninput={(event) => setWords(index, page, event.currentTarget.value)}
                    />
                  </label>
                {/if}
              </MarkControls>
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

  /* A Mark's picture fills it, and gives it its shape. */
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

  /* A Text Mark's words: a box at least 44 px high that takes the row's spare width. */
  .words {
    display: flex;
    flex: 1 1 14rem;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-weight: 600;
  }

  .words input {
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.25rem 0.75rem;
    border: 2px solid var(--muted);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    /* 16px or more, so iPhones don't zoom the page when it takes focus. */
    font: inherit;
    font-size: 1rem;
    font-weight: 400;
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
