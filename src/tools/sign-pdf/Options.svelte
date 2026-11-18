<script lang="ts">
  // The Signature pad, shown above Choose. A finger or mouse draws on it without
  // scrolling the page. Strokes go into the options as plain numbers, once each line is
  // finished, and are never stored anywhere.
  import type { OptionsProps } from '../types';
  import { padShape, tool, type Options, type Stroke } from './declaration';
  import { traceStrokes } from './paint';

  let { options = $bindable() }: OptionsProps<Options> = $props();

  const notes = tool.notes as Record<string, string>;
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
    const strokes = options.signature.strokes;
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
    options.signature = { kind: 'drawn', strokes: [...options.signature.strokes, drawing] };
    drawing = null;
  }

  function clear() {
    drawing = null;
    options.signature = { kind: 'drawn', strokes: [] };
  }
</script>

<section class="signature" aria-labelledby="signature-heading">
  <h2 id="signature-heading">{notes.signatureHeading}</h2>
  <p class="hint">{notes.padHint}</p>
  <canvas
    bind:this={canvas}
    class="pad"
    style:aspect-ratio={padShape}
    role="img"
    aria-label={notes.padLabel}
    onpointerdown={start}
    onpointermove={move}
    onpointerup={finish}
    onpointercancel={finish}
  ></canvas>
  <button type="button" class="small-button" onclick={clear}>{notes.clear}</button>
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
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    background: #fff;
    /* A finger draws here instead of scrolling the page. */
    touch-action: none;
    cursor: crosshair;
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
