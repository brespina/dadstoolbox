<script lang="ts">
  // A picture of a keyboard set to a Layout, with the next key to press lit. It is only a
  // picture for the eyes (a screen reader has the words), so it is hidden from assistive
  // technology and takes no focus.
  import { keyRows, locate, resolve, type Layout } from './layouts';

  let { layout, next }: { layout: Layout; next: string | undefined } = $props();

  const target = $derived(next === undefined ? null : locate(layout, next));
  // Where each row starts in the grid, in half keys, so the rows stagger like a real board.
  const starts = [1, 4, 5, 6];

  /** What a key shows: its character, or the one with Shift while it is the next key. */
  const label = (code: string) => resolve(layout, code, target?.code === code && target.shift);
</script>

<div class="keyboard" aria-hidden="true">
  {#each keyRows as row, r (r)}
    {#each row as code, i (code)}
      <span
        class="key"
        class:lit={target?.code === code}
        style:grid-row={r + 1}
        style:grid-column={`${starts[r]! + i * 2} / span 2`}>{label(code)}</span
      >
    {/each}
  {/each}
  <span class="key wide" class:lit={target?.shift} style="grid-row: 4; grid-column: 1 / span 5"
  ></span>
  <span class="key wide" class:lit={target?.shift} style="grid-row: 4; grid-column: 26 / span 4"
  ></span>
  <span
    class="key wide"
    class:lit={target?.code === 'Space'}
    style="grid-row: 5; grid-column: 8 / span 14"
  ></span>
</div>

<style>
  .keyboard {
    display: grid;
    grid-template-columns: repeat(29, minmax(0, 1fr));
    gap: 0.25rem 0.125rem;
    margin-top: 1.5rem;
    user-select: none;
    pointer-events: none;
  }

  .key {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 2.25rem;
    border: 1px solid var(--line);
    border-radius: 0.375rem;
    background: var(--surface);
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.9rem;
    line-height: 1;
    text-transform: uppercase;
  }

  .key.lit {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
    font-weight: 700;
  }
</style>
