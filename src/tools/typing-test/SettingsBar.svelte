<script lang="ts">
  // The typing test's settings bar. It fades while the visitor types (`quiet`), and comes
  // back on hover, focus or when the mouse moves. A new setting is a new ChoiceGroup here
  // and a new field of TypingSettings.
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import { tool } from './declaration';
  import type { Layout } from './layouts';
  import { secondsChoices, wordChoices, type TypingSettings } from './settings';

  let {
    settings = $bindable(),
    quiet,
    canChooseLayout,
  }: { settings: TypingSettings; quiet: boolean; canChooseLayout: boolean } = $props();

  const { notes } = tool;
  const numbers = <T extends number>(list: readonly T[]) =>
    list.map((value) => ({ value, label: String(value) }));
  const layoutChoices: { value: Layout; label: string }[] = [
    { value: 'own', label: notes.layoutOwn },
    { value: 'colemak', label: notes.layoutColemak },
    { value: 'dvorak', label: notes.layoutDvorak },
    { value: 'programmer-dvorak', label: notes.layoutProgrammerDvorak },
  ];
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
  {#if canChooseLayout}
    <ChoiceGroup
      legend={notes.layout}
      name="typing-layout"
      choices={layoutChoices}
      bind:value={settings.layout}
    />
  {/if}
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
