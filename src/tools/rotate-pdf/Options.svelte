<script lang="ts">
  import { tool, type Options, type Turn } from './declaration';

  let { options = $bindable() }: { options: Options } = $props();

  const notes = tool.notes;
  const choices: { turn: Turn; name: string }[] = [
    { turn: 'right', name: notes.rightName! },
    { turn: 'left', name: notes.leftName! },
    { turn: 'upsideDown', name: notes.upsideDownName! },
  ];
</script>

<fieldset class="turn">
  <legend>{notes.turnHeading}</legend>
  <div class="choices">
    {#each choices as choice (choice.turn)}
      <label class="choice">
        <input
          type="radio"
          class="visually-hidden"
          name="turn"
          value={choice.turn}
          bind:group={options.turn}
        />
        <span class="face">{choice.name}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .turn {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  /* Each choice is a big button; the chosen one is filled in. */
  .choice {
    display: flex;
    cursor: pointer;
  }

  .face {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font-weight: 600;
  }

  input:checked + .face {
    background: var(--action);
    color: var(--action-text);
  }

  input:focus-visible + .face {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
