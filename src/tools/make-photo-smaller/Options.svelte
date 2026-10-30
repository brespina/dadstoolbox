<script lang="ts">
  import RemoveLocation from '../../photos/RemoveLocation.svelte';
  import { text } from '../../text';
  import type { Options, Size } from './declaration';

  let { options = $bindable() }: { options: Options } = $props();

  const sizes = Object.keys(text.photos.sizes) as Size[];
</script>

<fieldset class="how-small">
  <legend>{text.photos.howSmall}</legend>
  <div class="choices">
    {#each sizes as size (size)}
      <label class="choice">
        <input
          type="radio"
          class="visually-hidden"
          name="size"
          value={size}
          bind:group={options.size}
        />
        <span class="face">
          <span class="name">{text.photos.sizes[size].name}</span>
          <span class="hint">{text.photos.sizes[size].hint}</span>
        </span>
      </label>
    {/each}
  </div>
</fieldset>

<RemoveLocation bind:options />

<style>
  .how-small {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  /* Each choice is a big button; the chosen one is filled in. */
  .choice {
    display: flex;
    cursor: pointer;
  }

  .face {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    min-height: 3.5rem;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
  }

  input:checked + .face {
    background: var(--action);
    color: var(--action-text);
  }

  input:focus-visible + .face {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .name {
    font-weight: 600;
  }

  .hint {
    font-size: 0.95rem;
  }
</style>
