<script lang="ts">
  import type { tool } from './declaration';

  // Combine PDFs has no options: the order is set on the waiting list.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
