<script lang="ts">
  // A home page row's blurb, for a Tool that needs browser features. Where one is
  // missing, it says so instead. Until the page runs, the blurb shows as it is.
  import { onMount } from 'svelte';
  import { browserCanRun } from '../site/features';
  import { text } from '../text';
  import type { BrowserFeature } from '../tools/types';

  let { blurb, needs }: { blurb: string; needs: readonly BrowserFeature[] } = $props();

  let works = $state(true);
  onMount(() => {
    works = browserCanRun(needs);
  });
</script>

<span class="tool-blurb">{works ? blurb : text.tool.unsupported}</span>

<style>
  .tool-blurb {
    display: block;
    color: var(--muted);
  }
</style>
