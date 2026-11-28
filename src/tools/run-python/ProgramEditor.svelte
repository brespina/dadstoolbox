<script lang="ts">
  // Where the visitor writes their Program. This is the editor seam: the rest of the page
  // knows only this interface, so a better editor (CodeMirror) can replace the inside of
  // this file without touching anything else.
  //
  // - `value`: the Program's text, in.
  // - `onchange(value)`: the visitor changed it, out.
  // - `focus()`: puts the cursor in the editor (call it on the component).
  // The editor is named by the Tool's `areaLabel`, which the generated page test finds.
  import { tool } from './declaration';

  let { value, onchange }: { value: string; onchange: (value: string) => void } = $props();

  let field: HTMLTextAreaElement;

  export function focus() {
    field.focus();
  }
</script>

<textarea
  bind:this={field}
  {value}
  aria-label={tool.areaLabel}
  rows="12"
  spellcheck="false"
  autocapitalize="off"
  autocomplete="off"
  oninput={(event) => onchange(event.currentTarget.value)}
></textarea>

<style>
  textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 14rem;
    padding: 0.75rem;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--surface);
    color: var(--text);
    /* 16 px or more, so iPhone Safari does not zoom in when the box takes focus. */
    font: 1rem / 1.5 var(--mono);
    resize: vertical;
    tab-size: 4;
  }
</style>
