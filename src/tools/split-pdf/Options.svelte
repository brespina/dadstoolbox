<script lang="ts">
  import type { tool } from './declaration';

  // Split a PDF has no options: every page becomes its own PDF.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
