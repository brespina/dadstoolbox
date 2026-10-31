<script lang="ts">
  import type { tool } from './declaration';

  // Remove photo location has no options.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
