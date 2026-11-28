<script lang="ts">
  // The buttons a chosen Mark shows: Smaller, Bigger and Remove. They work for any kind
  // of Mark, since they only ask for a change; `children` adds a kind's own controls
  // (such as a Text Mark's words) after them. Each button is named for the Mark it
  // acts on, starting with its visible words.
  import type { Snippet } from 'svelte';
  import { fillText as fill } from '../../text';
  import { tool } from './declaration';

  let {
    label,
    onsmaller,
    onbigger,
    onremove,
    children,
  }: {
    /** The Mark's own label, such as "Signature on page 2". */
    label: string;
    onsmaller: () => void;
    onbigger: () => void;
    onremove: () => void;
    children?: Snippet;
  } = $props();

  const notes = tool.notes as Record<string, string>;
  const named = (action: string) => fill(notes.controlLabel!, { action, mark: label });
</script>

<div class="controls">
  <button type="button" class="small-button" aria-label={named(notes.smaller!)} onclick={onsmaller}
    >{notes.smaller}</button
  >
  <button type="button" class="small-button" aria-label={named(notes.bigger!)} onclick={onbigger}
    >{notes.bigger}</button
  >
  <button type="button" class="small-button" aria-label={named(notes.remove!)} onclick={onremove}
    >{notes.remove}</button
  >
  {@render children?.()}
</div>

<style>
  .controls {
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
