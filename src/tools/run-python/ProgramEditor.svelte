<script lang="ts">
  // Where the visitor writes their Program. This is the editor seam: the rest of the page
  // knows only this interface, and the editor itself (CodeMirror, code-editor.ts) is
  // behind it.
  //
  // - `value`: the Program's text, in.
  // - `onchange(value)`: the visitor changed it, out.
  // - `focus()`: puts the cursor in the editor (call it on the component).
  // The editor is named by the Tool's `areaLabel`, which the generated page test finds.
  //
  // The editor lives in a shadow root. CodeMirror adds its styles as a `<style>` element,
  // which the Site's style hashes block; in a shadow root it adopts a stylesheet instead.
  // The Site's colours reach it as custom properties (`--code-*` in base.css).
  import { onMount } from 'svelte';
  import { tool } from './declaration';
  import { mountCodeEditor, type CodeEditor } from './code-editor';

  let { value, onchange }: { value: string; onchange: (value: string) => void } = $props();

  let host: HTMLDivElement;
  let editor: CodeEditor | undefined = $state.raw();

  export function focus() {
    editor?.focus();
  }

  onMount(() => {
    const mounted = mountCodeEditor({
      root: host.attachShadow({ mode: 'open' }),
      text: value,
      label: tool.areaLabel,
      onchange: (text) => onchange(text),
    });
    editor = mounted;
    return () => mounted.destroy();
  });

  // The page set a new Program (not the visitor typing, which the editor already holds).
  $effect(() => {
    if (editor && editor.text() !== value) editor.setText(value);
  });
</script>

<div class="editor" bind:this={host}></div>
<p class="hint">{tool.notes.leaveEditor}</p>

<style>
  .editor {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--code-bg);
  }

  .hint {
    margin: 0.25rem 0 0;
    color: var(--muted);
    font-size: 1rem;
  }
</style>
