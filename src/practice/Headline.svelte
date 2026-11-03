<script lang="ts">
  // The big numbers at the top of a Practice Tool's results, such as words per minute.
  // A `plain` number is set in the text colour, for one that is a yardstick rather than
  // the visitor's own score.
  let { items }: { items: readonly { label: string; value: string | number; plain?: boolean }[] } =
    $props();
</script>

<dl class="headline">
  {#each items as item (item.label)}
    <div>
      <dt>{item.label}</dt>
      <dd class:plain={item.plain}>{item.value}</dd>
    </div>
  {/each}
</dl>

<style>
  .headline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2.5rem;
    margin: 0 0 1rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    color: var(--action);
    font-family: var(--mono);
    font-size: 3rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  dd.plain {
    color: var(--text);
  }
</style>
