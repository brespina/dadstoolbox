<script lang="ts">
  // Run Python's page: a small shell. PracticeToolPage.svelte imports every Practice
  // page into every Practice Tool's page, so the large parts (the runner, the worker,
  // the editor in #130) load with `import()` only once this page is open, under "Getting
  // ready…" (ADR-0005). Python itself loads later still, inside the worker.
  import { onMount, type Component } from 'svelte';
  import { text } from '../../text';

  let Page: Component | undefined = $state.raw();

  onMount(() => {
    void import('./RunPython.svelte').then((module) => (Page = module.default));
  });
</script>

{#if Page}
  <Page />
{:else}
  <p role="status">{text.tool.gettingReady}</p>
{/if}
