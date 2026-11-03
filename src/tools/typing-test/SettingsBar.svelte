<script lang="ts">
  // The typing test's settings bar. It fades while the visitor types (`quiet`), and comes
  // back on hover, focus or when the mouse moves. A new setting is a new ChoiceGroup or
  // Switch here and a new field of TypingSettings.
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import Switch from '../../practice/Switch.svelte';
  import { tool } from './declaration';
  import { secondsChoices, wordChoices, type TypingSettings } from './settings';

  let { settings = $bindable(), quiet }: { settings: TypingSettings; quiet: boolean } = $props();

  const { notes } = tool;
  const numbers = <T extends number>(list: readonly T[]) =>
    list.map((value) => ({ value, label: String(value) }));
</script>

<div class="settings" class:quiet>
  <ChoiceGroup
    legend={notes.test}
    name="typing-test"
    choices={[
      { value: 'time', label: notes.time },
      { value: 'words', label: notes.words },
    ]}
    bind:value={settings.test}
  />
  {#if settings.test === 'time'}
    <ChoiceGroup
      legend={notes.seconds}
      name="typing-seconds"
      choices={numbers(secondsChoices)}
      bind:value={settings.seconds}
    />
  {:else}
    <ChoiceGroup
      legend={notes.words}
      name="typing-words"
      choices={numbers(wordChoices)}
      bind:value={settings.words}
    />
  {/if}
  <Switch label={notes.punctuation} bind:checked={settings.punctuation} />
  <Switch label={notes.numbers} bind:checked={settings.numbers} />
</div>

<style>
  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-bottom: 1.5rem;
    transition: opacity 0.3s ease;
  }

  .settings.quiet:not(:hover, :focus-within) {
    opacity: 0;
  }
</style>
