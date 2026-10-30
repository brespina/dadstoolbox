<script lang="ts">
  import type { tool } from './declaration';

  // Make a video play anywhere has no options: the picture size and sound are kept.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
