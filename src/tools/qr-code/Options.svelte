<script lang="ts">
  import StyleSection from '../../qr/StyleSection.svelte';
  import type { tool } from './declaration';

  // Only the Style: closed, it gives a black-on-white code, ready to print.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
</script>

<StyleSection bind:style={options.style} />
