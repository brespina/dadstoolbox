<script lang="ts">
  // The interactive part of a Practice Tool's page: the Tool's own Practice.svelte.
  // Astro can only hydrate a component it imports by name, so this one picks the Tool's
  // page from all of them. They are small, so every practice page has them all.
  import type { Component } from 'svelte';

  let { address }: { address: string } = $props();

  const practicePages = import.meta.glob<{ default: Component }>(
    ['../tools/*/Practice.svelte', '!../tools/_*/Practice.svelte'],
    { eager: true },
  );
  // The address never changes on a page, so reading it once is right.
  // svelte-ignore state_referenced_locally
  const Practice = practicePages[`../tools/${address}/Practice.svelte`]!.default;
</script>

<Practice />
