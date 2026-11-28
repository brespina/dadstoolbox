<script lang="ts">
  // Run Python's page: a small shell. PracticeToolPage.svelte imports every Practice
  // page into every Practice Tool's page, so the large parts (the runner, the worker,
  // the editor in #130) load with `import()` only once this page is open, under "Getting
  // ready…" (ADR-0005). Python itself loads later still, inside the worker.
  //
  // First the page is made cross-origin isolated (isolation.ts, ADR-0009). On a first
  // visit that registers the service worker and reloads once, before any editor exists,
  // so nothing typed is lost.
  import { onMount, type Component } from 'svelte';
  import { text } from '../../text';
  import { sitePath } from '../../site/paths';
  import { isolate } from './isolation';

  let Page: Component<{ isolated: boolean }> | undefined = $state.raw();
  let isolated = $state(false);

  onMount(() => {
    // sitePath always ends in "/", so the file name goes after it.
    void isolate(sitePath('run-python') + 'coi-sw.js')
      .then((result) => {
        isolated = result === 'isolated';
        return import('./RunPython.svelte');
      })
      .then((module) => (Page = module.default as Component<{ isolated: boolean }>));
  });
</script>

{#if Page}
  <Page {isolated} />
{:else}
  <p role="status">{text.tool.gettingReady}</p>
{/if}
