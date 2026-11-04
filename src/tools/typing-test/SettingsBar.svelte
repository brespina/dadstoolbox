<script lang="ts">
  // The typing test's settings bar. It fades while the visitor types (`quiet`), and comes
  // back on hover, focus or when the mouse moves. Faded, it is fully clear (there is no
  // half-faded text to read, and with reduced motion no fade at all) but stays in the
  // page for screen readers and Tab, and focusing a setting shows the bar again. A new
  // setting is a new ChoiceGroup or Switch here and a new field of TypingSettings.
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import Switch from '../../practice/Switch.svelte';
  import { tool } from './declaration';
  import { layouts, type Layout } from './layouts';
  import { secondsChoices, wordChoices, type TypingSettings } from './settings';

  let {
    settings = $bindable(),
    quiet,
    canChooseLayout,
  }: { settings: TypingSettings; quiet: boolean; canChooseLayout: boolean } = $props();

  const { notes } = tool;
  const numbers = <T extends number>(list: readonly T[]) =>
    list.map((value) => ({ value, label: String(value) }));
  // Every Layout needs a name here, or the type check fails.
  const layoutNames: Record<Layout, string> = {
    own: notes.layoutOwn,
    colemak: notes.layoutColemak,
    dvorak: notes.layoutDvorak,
    'programmer-dvorak': notes.layoutProgrammerDvorak,
  };
  const layoutChoices = layouts.map((value) => ({ value, label: layoutNames[value] }));
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
