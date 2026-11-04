<script lang="ts">
  // One on/off setting on a Practice Tool's settings bar. A real checkbox, so Space and
  // screen readers work as usual; it looks like the ChoiceGroup beside it.
  let { label, checked = $bindable() }: { label: string; checked: boolean } = $props();
</script>

<div class="switch">
  <label class:chosen={checked}>
    <input type="checkbox" bind:checked />
    {label}
  </label>
</div>

<style>
  /* Lines up with a ChoiceGroup: the bottom of the box matches its row of choices. */
  .switch {
    align-self: flex-end;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--surface);
    padding: 0.125rem;
  }

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
