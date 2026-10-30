<script lang="ts">
  import type { tool } from './declaration';

  // Get the sound from a video has no options: the sound is copied as it is.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
