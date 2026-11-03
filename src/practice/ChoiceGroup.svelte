<script lang="ts" generics="T extends string | number">
  // One setting on a Practice Tool's settings bar: a labelled row of choices, one chosen.
  // Real radio buttons, so arrow keys and screen readers work as usual.
  let {
    legend,
    name,
    choices,
    value = $bindable(),
  }: {
    legend: string;
    /** The radio buttons' group name, unique on the page. */
    name: string;
    choices: readonly { value: T; label: string }[];
    value: T;
  } = $props();
</script>

<fieldset class="choice-group">
  <legend>{legend}</legend>
  <div class="choices">
    {#each choices as choice (choice.value)}
      <label class:chosen={value === choice.value}>
        <input type="radio" {name} value={choice.value} bind:group={value} />
        {choice.label}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .choice-group {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.25rem;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--surface);
    padding: 0.125rem;
  }

  /* At least 44 x 44 px to tap. The radio covers its label, unseen, so a tap anywhere
     on the label chooses it. */
  label {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border-radius: 0.375rem;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  label.chosen {
    background: var(--action);
    color: var(--action-text);
    font-weight: 600;
  }

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  label:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
