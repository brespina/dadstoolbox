<script lang="ts">
  import type { Options } from './declaration';

  // Trim a video has no options for every video: Start and End belong to each video,
  // on its Ready row (FileOptions.svelte).
  let { options = $bindable() }: { options: Options } = $props();
  void options;
</script>
