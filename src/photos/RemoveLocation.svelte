<script lang="ts">
  // The shared "Remove location" checkbox for the photo Tools, ticked by default.
  import { text } from '../text';
  import type { LocationOption } from './options';

  let { options = $bindable() }: { options: LocationOption } = $props();
</script>

<label class="remove-location">
  <input type="checkbox" bind:checked={options.removeLocation} />
  <span>
    <span class="label">{text.photos.removeLocation}</span>
    <span class="muted">{text.photos.removeLocationHint}</span>
  </span>
</label>

<style>
  .remove-location {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-height: 2.75rem;
    cursor: pointer;
  }

  input {
    width: 1.5rem;
    height: 1.5rem;
    margin: 0.1rem 0 0;
    flex-shrink: 0;
    accent-color: var(--action);
  }

  .remove-location > span {
    display: flex;
    flex-direction: column;
  }

  .label {
    font-weight: 600;
  }
</style>
