<script lang="ts">
  // A Mark on its page: a focusable element that a finger, mouse or keyboard moves and
  // resizes. It works for any kind of Mark; `children` draws the kind's picture. It turns
  // events into calls on the rules in marks.ts and gives the changed Mark to `onchange`,
  // so it holds no place of its own. Its parent must be the page, positioned, since the
  // Mark is placed by percent of it.
  import type { Snippet } from 'svelte';
  import type { Mark } from './declaration';
  import { actionFor, dragTo, nudge, resize, type Fit, type Point } from './marks';

  let {
    id,
    mark,
    fit,
    label,
    chosen,
    blank = false,
    onchoose,
    onchange,
    onremove,
    children,
  }: {
    id: string;
    mark: Mark;
    fit: Fit;
    /** Its name for a screen reader: its kind and page, such as "Signature on page 2". */
    label: string;
    chosen: boolean;
    /** Draw a dashed box with the children in it, for a Mark whose picture isn't made yet. */
    blank?: boolean;
    onchoose: () => void;
    onchange: (mark: Mark) => void;
    onremove: () => void;
    children: Snippet;
  } = $props();

  /** How far, in CSS pixels, a press must move before it drags, so a tap doesn't nudge. */
  const dragSlop = 3;

  let drag: { id: number; start: Mark; grab: Point; from: Point } | null = null;
  let dragging = $state(false);

  /** Where the pointer is on the page, as fractions of the page as shown. */
  function onPage(event: PointerEvent): Point {
    const box = (event.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }

  function onpointerdown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    // A press on a Mark is not a tap on the page under it.
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;
    // So the moves and the release still come when the pointer leaves the Mark.
    element.setPointerCapture(event.pointerId);
    // Safari doesn't focus a button that is pressed.
    element.focus();
    onchoose();
    const point = onPage(event);
    drag = {
      id: event.pointerId,
      start: mark,
      grab: { x: point.x - mark.x, y: point.y - mark.y },
      from: { x: event.clientX, y: event.clientY },
    };
  }

  function onpointermove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - drag.from.x, event.clientY - drag.from.y) < dragSlop) return;
      dragging = true;
    }
    onchange(dragTo(drag.start, drag.grab, onPage(event), fit));
  }

  // A cancelled touch ends the drag where it got to.
  function onpointerend(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    dragging = false;
  }

  function onkeydown(event: KeyboardEvent) {
    // Keys typed into something inside the Mark (such as a words box) are its own.
    if (event.target !== event.currentTarget) return;
    const action = actionFor(event);
    if (!action) return;
    event.preventDefault();
    if (action.do === 'move') onchange(nudge(mark, action.direction, action.big, fit));
    else if (action.do === 'size') onchange(resize(mark, action.way, fit));
    else onremove();
  }
</script>

<button
  {id}
  type="button"
  class="mark"
  class:chosen
  class:blank
  class:dragging
  style:left={`${mark.x * 100}%`}
  style:top={`${mark.y * 100}%`}
  style:width={`${mark.width * 100}%`}
  style:aspect-ratio={fit.markAspect}
  aria-label={label}
  aria-pressed={chosen}
  onclick={onchoose}
  onfocus={onchoose}
  {onpointerdown}
  {onpointermove}
  onpointerup={onpointerend}
  onpointercancel={onpointerend}
  {onkeydown}
>
  {@render children()}
</button>

<style>
  .mark {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 2px dashed transparent;
    background: transparent;
    cursor: grab;
    /* A finger that starts on a Mark drags it instead of scrolling the pages. Only here:
       a finger anywhere else on a page still scrolls. */
    touch-action: none;
    /* A long press on a phone selects or shows a menu, which would fight a drag. */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .mark.dragging {
    cursor: grabbing;
  }

  /* The picture inside is part of the Mark, so a press on it grabs the Mark. */
  .mark > :global(*) {
    pointer-events: none;
  }

  /* Before a Signature is drawn: its name in a dashed box, dark on the white page. */
  .mark.blank {
    border-color: #555;
    color: #222;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    background: rgb(255 255 255 / 0.85);
  }

  /* The pages stay white in both themes, so the chosen Mark's edge is a fixed dark blue. */
  .mark.chosen {
    border: 2px solid #0b57d0;
  }

  .mark:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
