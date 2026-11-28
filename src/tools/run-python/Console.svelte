<script lang="ts">
  // The Console: what the Program has printed, shown as text (never as HTML) in a labelled
  // live region. Error output is told apart by more than colour: a bar beside it, and the
  // words "Error:" for a screen reader. The page's own words ("Done.") are a third kind,
  // never mixed into the Program's output. The runs come from console-buffer.ts; the page
  // hands over a new set at most once per animation frame.
  import type { ConsoleRun } from './console-buffer';
  import { tool } from './declaration';

  const { notes } = tool;

  let { runs, removed }: { runs: ConsoleRun[]; removed: boolean } = $props();
</script>

<!-- tabindex: the Console scrolls, so the keyboard must be able to reach it. -->
<div class="console" role="log" aria-label={notes.consoleLabel} tabindex="0">
  {#if removed}
    <p class="removed">{notes.linesRemoved}</p>
  {/if}
  {#each runs as run, i (i)}
    {#if run.stream === 'stderr'}
      <span class="error"
        ><span class="visually-hidden">{notes.errorMark}</span>{run.text.endsWith('\n')
          ? run.text.slice(0, -1)
          : run.text}</span
      >
    {:else if run.stream === 'note'}
      <span class="note">{run.text.endsWith('\n') ? run.text.slice(0, -1) : run.text}</span>
    {:else}
      <span class="plain">{run.text}</span>
    {/if}
  {:else}
    <span class="empty" aria-hidden="true">{notes.consoleEmpty}</span>
  {/each}
</div>

<style>
  .console {
    box-sizing: border-box;
    min-height: 8rem;
    max-height: 24rem;
    padding: 0.75rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--surface);
    color: var(--text);
    font: 0.9375rem / 1.5 var(--mono);
  }

  /* Only the Program's own text keeps its spaces and newlines, so the markup's own
     whitespace between the pieces never shows. */
  .plain,
  .error {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .console:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .empty,
  .removed {
    color: var(--muted);
  }

  .removed {
    margin: 0 0 0.5rem;
    font-style: italic;
  }

  /* The page's own words ("Done."), apart from the Program's output: italic, with a rule
     above, so it reads as a statement about the Run and not as something it printed. */
  .note {
    display: block;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--line);
    font-style: italic;
  }

  /* A bar beside the lines, and bold letters: visible without colour too. */
  .error {
    display: block;
    padding-left: 0.5rem;
    border-left: 4px solid var(--problem);
    color: var(--problem);
    font-weight: 600;
  }
</style>
