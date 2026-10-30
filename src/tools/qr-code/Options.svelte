<script lang="ts">
  import type { tool } from './declaration';

  // Make a QR code has no options: the code is black on white, ready to print.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
