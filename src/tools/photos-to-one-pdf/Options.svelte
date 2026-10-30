<script lang="ts">
  import type { tool } from './declaration';

  // Photos to one PDF has no options: the order is set on the waiting list, and the
  // location is always left out.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
  void options;
</script>
