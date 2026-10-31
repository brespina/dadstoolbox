<script lang="ts">
  import { onMount } from 'svelte';
  import RemoveLocation from '../../photos/RemoveLocation.svelte';
  import { canSaveWebp } from '../../photos/webp';
  import { text } from '../../text';
  import type { OptionsProps } from '../types';
  import type { Options } from './declaration';
  import { offeredFormats } from './formats';

  let { options = $bindable(), fileTypes = [] }: OptionsProps<Options> = $props();

  // WebP is offered only where the browser can save it, so it is checked on the page.
  let webp = $state(false);
  onMount(() => {
    canSaveWebp().then((yes) => (webp = yes));
  });
  // A type the chosen images already are is left out, so no choice does nothing.
  let formats = $derived(offeredFormats(fileTypes, webp));
  // If the chosen type was left out, the first type still offered takes its place.
  $effect(() => {
    if (!formats.includes(options.format)) options.format = formats[0]!;
  });
</script>

<fieldset class="save-as">
  <legend>{text.photos.saveAs}</legend>
  <div class="choices">
    {#each formats as format (format)}
      <label class="choice">
        <input
          type="radio"
          class="visually-hidden"
          name="format"
          value={format}
          bind:group={options.format}
        />
        <span class="face">
          <span class="name">{text.photos.formats[format].name}</span>
          <span class="hint">{text.photos.formats[format].hint}</span>
        </span>
      </label>
    {/each}
  </div>
</fieldset>

<!-- An ICO holds no photo details, so there is no location to remove. -->
{#if options.format !== 'ico'}
  <RemoveLocation bind:options />
{/if}

<style>
  .save-as {
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
