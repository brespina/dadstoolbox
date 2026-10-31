<script lang="ts">
  import StyleSection from '../../qr/StyleSection.svelte';
  import { tool } from './declaration';

  // The Tool has no type box: these fields and the Style hold everything, and the code
  // follows them.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
</script>

<!-- Plain text, never capitalised or corrected: one wrong letter makes a code that won't join. -->
<label class="field">
  <span class="label">{tool.notes.name}</span>
  <input
    type="text"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    bind:value={options.name}
  />
</label>

<div class="field">
  <label class="label" for="wifi-password">{tool.notes.password}</label>
  <span class="hint" id="wifi-password-hint">{tool.notes.passwordHint}</span>
  <input
    id="wifi-password"
    type="text"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    aria-describedby="wifi-password-hint"
    bind:value={options.password}
  />
</div>

<StyleSection bind:style={options.style} />

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-weight: 600;
  }

  .hint {
    color: var(--muted);
  }

  /* At least 44 px tall to tap. */
  input {
    width: 100%;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  input:focus {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
