<script lang="ts">
  // A Practice Tool's restart button, under the practice area, with the hint that Tab
  // then Enter reaches it from the keyboard.
  import { text } from '../text';

  let { label, onclick }: { label: string; onclick: () => void } = $props();
</script>

<div class="restart">
  <button type="button" {onclick}>{label}</button>
  <span class="muted">{text.practice.restartHint}</span>
</div>

<style>
  .restart {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-top: 1.25rem;
  }

  button {
    min-height: 2.75rem;
    padding: 0 1.25rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--action);
    color: var(--action-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
