<script lang="ts">
  // The Signature and the ink, shown above Choose. A finger or mouse draws on the pad
  // without scrolling the page; "Type it instead" swaps the pad for a box to type in. Strokes
  // go into the options as plain numbers, once each line is finished, and typed words as
  // they are typed. The options hold one or the other, whichever was chosen last. Nothing
  // here is stored anywhere.
  import { tick } from 'svelte';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import type { OptionsProps } from '../types';
  import { inks, signatureFont, tool, type Options, type Stroke } from './declaration';
  import { traceStrokes } from './paint';
  import { loadSignatureFont } from './signature-font';

  let { options = $bindable() }: OptionsProps<Options> = $props();

  const notes = tool.notes as Record<string, string>;
  const uid = $props.id();
  const inkChoices: { value: Options['ink']; label: string }[] = [
    { value: 'black', label: notes.inkBlack! },
    { value: 'blue', label: notes.inkBlue! },
  ];
  // Whether the box to type in shows instead of the pad. Each way keeps what it holds while
  // the other shows, so swapping back loses nothing; only the way shown is the Signature.
  let typing = $state(false);
  let keptStrokes: Stroke[] = [];
  let keptWords = '';
  let box: HTMLInputElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  // The line being drawn now, before it joins the options.
  let drawing: Stroke | null = $state.raw(null);
  // The canvas's size in pixels, kept to the pad's shown size.
  let pixels = $state({ width: 0, height: 0 });

  $effect(() => {
    if (!canvas) return;
    const watching = new ResizeObserver(([entry]) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = entry!.contentRect;
      pixels = { width: Math.round(width * ratio), height: Math.round(height * ratio) };
    });
    watching.observe(canvas);
    return () => watching.disconnect();
  });

  // Redraw whenever the strokes or the size change.
  $effect(() => {
    if (!canvas || pixels.width === 0) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const context = canvas.getContext('2d')!;
    // Strokes are traced in pad widths.
    context.scale(pixels.width, pixels.width);
    const strokes = options.signature.kind === 'drawn' ? options.signature.strokes : [];
    traceStrokes(context, drawing ? [...strokes, drawing] : strokes, options.ink);
  });

  /** Where the pointer is, as fractions of the pad, kept short. */
  function pointAt(event: PointerEvent): Stroke[number] {
    const box = canvas!.getBoundingClientRect();
    const fraction = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 1e4) / 1e4;
    return [
      fraction((event.clientX - box.left) / box.width),
      fraction((event.clientY - box.top) / box.height),
    ];
  }

  function start(event: PointerEvent) {
    if (event.button !== 0) return;
    canvas!.setPointerCapture(event.pointerId);
    drawing = [pointAt(event)];
  }

  function move(event: PointerEvent) {
    if (!drawing) return;
    drawing = [...drawing, pointAt(event)];
  }

  function finish() {
    if (!drawing) return;
    const strokes = options.signature.kind === 'drawn' ? options.signature.strokes : [];
    options.signature = { kind: 'drawn', strokes: [...strokes, drawing] };
    drawing = null;
  }

  function clear() {
    drawing = null;
    options.signature = { kind: 'drawn', strokes: [] };
  }

  /**
   * Swaps the pad and the box. The font loads the first time the box is wanted, and the
   * words only join the options once it has: measuring them sooner would use the device's
   * own letters, and the Mark would be laid out in a shape the saved PDF doesn't have.
   */
  async function swap() {
    drawing = null;
    if (typing) {
      typing = false;
      options.signature = { kind: 'drawn', strokes: keptStrokes };
      return;
    }
    await loadSignatureFont();
    if (options.signature.kind === 'drawn') keptStrokes = options.signature.strokes;
    typing = true;
    options.signature = { kind: 'typed', words: keptWords, font: signatureFont };
    await tick();
    box?.focus();
  }

  function typed(event: Event & { currentTarget: HTMLInputElement }) {
    keptWords = event.currentTarget.value;
    options.signature = { kind: 'typed', words: keptWords, font: signatureFont };
  }
</script>

<section class="signature" aria-labelledby="signature-heading">
  <h2 id="signature-heading">{notes.signatureHeading}</h2>
  <p class="hint">{typing ? notes.typedHint : notes.padHint}</p>
  {#if typing}
    <!-- Typed words are kept exactly as typed; each script sets its own direction. -->
    <input
      bind:this={box}
      class="typed"
      type="text"
      dir="auto"
      maxlength="60"
      autocomplete="off"
      autocapitalize="words"
      spellcheck="false"
      aria-label={notes.typedLabel}
      value={options.signature.kind === 'typed' ? options.signature.words : ''}
      oninput={typed}
      style:color={inks[options.ink]}
    />
  {:else}
    <canvas
      bind:this={canvas}
      class="pad"
      role="img"
      aria-label={notes.padLabel}
      onpointerdown={start}
      onpointermove={move}
      onpointerup={finish}
      onpointercancel={finish}
    ></canvas>
  {/if}
  <div class="buttons">
    {#if !typing}
      <button type="button" class="small-button" onclick={clear}>{notes.clear}</button>
    {/if}
    <button type="button" class="small-button" onclick={swap}>
      {typing ? notes.drawItInstead : notes.typeItInstead}
    </button>
  </div>
  <ChoiceGroup
    legend={notes.inkLegend!}
    name={`${uid}-ink`}
    choices={inkChoices}
    bind:value={options.ink}
  />
</section>

<style>
  .signature {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  h2,
  .hint {
    margin: 0;
  }

  /* Paper-white in both themes, so the ink shows as it will on the page. */
  .pad {
    width: 100%;
    /* padShape in declaration.ts. Not a style attribute: the browser lock blocks those. */
    aspect-ratio: 3;
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    background: #fff;
    /* A finger draws here instead of scrolling the page. */
    touch-action: none;
    cursor: crosshair;
  }

  /* The typed Signature, in its font and the ink, 16px or more so iPhones don't zoom. */
  .typed {
    width: 100%;
    box-sizing: border-box;
    min-height: 3.5rem;
    padding: 0.25rem 0.75rem;
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    background: #fff;
    font-family: 'Dancing Script', system-ui, sans-serif;
    font-size: 2rem;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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
