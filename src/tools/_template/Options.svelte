<script lang="ts">
  import type { tool } from './declaration';

  // The Tool's options, shown above Choose. Bind each control to a field of `options`;
  // the shared page passes the values to `run` when start is pressed.
  // Words here are not checked by the banned-words scan, so follow the wording rules
  // by hand.
  let { options = $bindable() }: { options: typeof tool.defaultOptions } = $props();
</script>

<label class="option">
  <input type="checkbox" bind:checked={options.capitals} />
  Write it all in capitals
</label>

<style>
  .option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
  }

  .option input {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
